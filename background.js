// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Auto-open side panel on GtR pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('gtr.ukri.org')) {
        chrome.sidePanel.setOptions({
            tabId: tabId,
            path: 'sidepanel.html',
            enabled: true
        });
    }
});

// Handle link validation requests from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'validateLink') {
        detectLinkRot(request.url)
            .then(result => sendResponse(result))
            .catch(error => {
                console.error('LinkRot detection error:', error);
                sendResponse({
                    originalUrl: request.url,
                    status: 'live',
                    message: 'Could not check for linkrot - assuming content is available'
                });
            });
        return true; // Keep message channel open for async response
    }
});

// Main function to detect link rot - much more conservative approach
async function detectLinkRot(url) {
    try {
        console.log(`Checking for linkrot: ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow', // Follow all redirects
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        clearTimeout(timeoutId);

        const finalUrl = response.url;
        const wasRedirected = finalUrl !== url;

        console.log(`Original URL: ${url}`);
        console.log(`Final URL: ${finalUrl}`);
        console.log(`HTTP Status: ${response.status}`);
        console.log(`Was redirected: ${wasRedirected}`);

        // Only check for linkrot if we get an explicit 404 status
        if (response.status === 404) {
            console.log(`HTTP 404 detected for ${url} - checking for archive`);
            return await checkWithArchive(url);
        }

        // For status 200-399, assume content is accessible
        if (response.status >= 200 && response.status < 400) {
            return {
                originalUrl: url,
                finalUrl: wasRedirected ? finalUrl : null,
                status: 'live',
                message: wasRedirected ?
                    'Content redirected but accessible' :
                    'Content accessible'
            };
        }

        // For other error codes (5xx server errors, etc.), be more cautious
        // These might be temporary issues, so don't immediately assume linkrot
        if (response.status >= 500) {
            console.log(`Server error ${response.status} for ${url} - assuming temporary issue`);
            return {
                originalUrl: url,
                status: 'live',
                message: `Server error ${response.status} - may be temporary`
            };
        }

        // For 4xx errors other than 404, check content to be sure
        const contentType = response.headers.get('content-type') || '';

        // For non-HTML content with 4xx errors, it might still be accessible
        if (!contentType.includes('text/html')) {
            return {
                originalUrl: url,
                status: 'live',
                message: `HTTP ${response.status} but non-HTML content may be accessible`
            };
        }

        // Only for HTML pages with 4xx errors, analyze the content
        const text = await response.text();
        const linkrotResult = analyzePage(text, url, finalUrl, wasRedirected, response.status);

        return linkrotResult;

    } catch (error) {
        console.log(`Network error for ${url}:`, error.message);

        // For network errors, be very conservative - most are temporary
        if (error.name === 'AbortError') {
            return {
                originalUrl: url,
                status: 'live',
                message: 'Request timeout - content may still be accessible'
            };
        }

        // Only for DNS resolution failures or connection refused, consider checking archive
        if (error.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
            error.message.includes('net::ERR_CONNECTION_REFUSED')) {
            console.log(`Definite network failure for ${url} - checking archive`);
            return await checkWithArchive(url);
        }

        // For other network errors, assume it's temporary
        return {
            originalUrl: url,
            status: 'live',
            message: `Network error (${error.message}) - may be temporary`
        };
    }
}

// Analyze page content for linkrot indicators - extremely conservative approach
function analyzePage(htmlContent, originalUrl, finalUrl, wasRedirected, httpStatus) {
    const lowerContent = htmlContent.toLowerCase();

    // Extract title for analysis
    const title = extractTitle(htmlContent);
    console.log(`Page title: "${title}"`);
    console.log(`HTTP Status: ${httpStatus}`);
    console.log(`Content length: ${htmlContent.length}`);

    // If the page has substantial content (>1000 characters), it's probably not an error page
    if (htmlContent.length > 1000) {
        console.log(`Page has substantial content (${htmlContent.length} chars) - assuming live`);
        return {
            originalUrl: originalUrl,
            finalUrl: wasRedirected ? finalUrl : null,
            status: 'live',
            message: wasRedirected ?
                'Content redirected but accessible' :
                'Content accessible'
        };
    }

    const titleLower = title.toLowerCase().trim();

    // Only check for EXACT title matches for very common 404 page titles
    const exact404Titles = [
        'page not found',
        '404 not found',
        '404 - not found',
        '404 error',
        'error 404',
        'not found',
        '404'
    ];

    const hasExact404Title = exact404Titles.some(pattern => titleLower === pattern);

    // Check if redirected to obvious parking/expired domains (most reliable indicator)
    const knownParkingDomains = [
        'sedo.com',
        'sedoparking.com',
        'parkingcrew.net',
        'hugedomains.com',
        'godaddy.com/domainsearch',
        'namecheap.com/domains'
    ];

    const redirectedToParkingDomain = wasRedirected && knownParkingDomains.some(domain =>
        finalUrl.includes(domain)
    );

    // Check for very explicit domain expiration messages
    const explicitExpirationMessages = [
        'this domain has expired',
        'domain expired',
        'expired domain'
    ];

    const hasExplicitExpiration = explicitExpirationMessages.some(msg =>
        lowerContent.includes(msg)
    );

    // Only flag as linkrot for the most obvious cases
    const isDefinitelyLinkrot = hasExact404Title ||
        redirectedToParkingDomain ||
        hasExplicitExpiration;

    if (isDefinitelyLinkrot) {
        console.log(`Very strong LinkRot evidence detected for ${originalUrl}`);
        console.log(`- Exact 404 title: ${hasExact404Title} (title: "${titleLower}")`);
        console.log(`- Parking domain redirect: ${redirectedToParkingDomain}`);
        console.log(`- Explicit expiration: ${hasExplicitExpiration}`);

        // This is definite linkrot - check for archived version
        return checkWithArchive(originalUrl);
    }

    // For ANY other case, assume the content is live and accessible
    console.log(`No strong linkrot evidence found - marking as live`);
    return {
        originalUrl: originalUrl,
        finalUrl: wasRedirected ? finalUrl : null,
        status: 'live',
        message: wasRedirected ?
            'Content redirected but accessible' :
            'Content accessible'
    };
}

// Extract page title
function extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : '';
}

// Extract meta description
function extractMetaDescription(html) {
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    return metaMatch ? metaMatch[1].trim() : '';
}

// Check archive.org for archived versions when linkrot is detected
async function checkWithArchive(url) {
    try {
        console.log(`Checking archive for linkrot URL: ${url}`);

        const archiveApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
        const response = await fetch(archiveApiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LinkRotChecker/1.0)'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.archived_snapshots && data.archived_snapshots.closest) {
                const snapshot = data.archived_snapshots.closest;
                const archiveDate = new Date(
                    snapshot.timestamp.substring(0, 4) + '-' +
                    snapshot.timestamp.substring(4, 6) + '-' +
                    snapshot.timestamp.substring(6, 8)
                ).toLocaleDateString();

                return {
                    originalUrl: url,
                    status: 'linkrot_archived',
                    archiveUrl: snapshot.url,
                    timestamp: snapshot.timestamp,
                    message: `LinkRot detected - Archived version available (${archiveDate})`
                };
            }
        }

        return {
            originalUrl: url,
            status: 'linkrot_no_archive',
            message: 'LinkRot detected - Original content no longer available, no archive found'
        };

    } catch (error) {
        console.error(`Archive check failed for ${url}:`, error);
        return {
            originalUrl: url,
            status: 'linkrot_no_archive',
            message: 'LinkRot detected - Could not check archive'
        };
    }
}