// GtR Project Analyzer - Side Panel Script
document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    const btnText = document.getElementById('btnText');
    const projectInfo = document.getElementById('projectInfo');
    const projectTitle = document.getElementById('projectTitle');
    const projectRef = document.getElementById('projectRef');
    const statsGrid = document.getElementById('statsGrid');
    const totalOutcomes = document.getElementById('totalOutcomes');
    const detectedCount = document.getElementById('detectedCount');
    const extractedCount = document.getElementById('extractedCount');
    const successRate = document.getElementById('successRate');
    const resultsTitle = document.getElementById('resultsTitle');

    const HF_SPACE_URL = "https://shiyizhu-gtroutcomegetter.hf.space";

    checkCurrentTab();
    analyzeBtn.addEventListener('click', analyzeProject);

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            checkCurrentTab();
        }
    });

    chrome.tabs.onActivated.addListener(() => {
        checkCurrentTab();
    });

    function checkCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url) return;

            const projectData = getProjectDataFromUrl(currentTab.url);
            if (projectData) {
                showProjectInfo(projectData);
                analyzeBtn.disabled = false;
                updateBtnText('Analyze Current Project');
            } else {
                hideProjectInfo();
                analyzeBtn.disabled = true;
                updateBtnText('Not a GtR Project Page');
            }
        });
    }

    function getProjectDataFromUrl(url) {
        try {
            const urlObject = new URL(url);
            if (urlObject.hostname.includes('gtr.ukri.org') && urlObject.searchParams.has('ref')) {
                const ref = decodeURIComponent(urlObject.searchParams.get('ref'));
                return {
                    ref: ref,
                    url: url
                };
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function showProjectInfo(projectData) {
        projectRef.textContent = projectData.ref;
        projectInfo.style.display = 'block';

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].title) {
                let title = tabs[0].title.replace('Gateway to Research', '').trim();
                if (title.startsWith('- ')) title = title.substring(2);
                projectTitle.textContent = title || 'GtR Project';
            }
        });
    }

    function hideProjectInfo() {
        projectInfo.style.display = 'none';
        hideResults();
    }

    function analyzeProject() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url) {
                updateStatus('Error: Could not get current tab URL.', 'error');
                return;
            }

            const projectData = getProjectDataFromUrl(currentTab.url);
            if (!projectData) {
                updateStatus('This is not a valid GtR project page.', 'error');
                return;
            }

            startAnalysis();

            const encodedProjectRef = encodeURIComponent(projectData.ref);
            const apiUrl = `${HF_SPACE_URL}/analyze-project/${encodedProjectRef}`;

            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw { status: response.status, statusText: response.statusText, body: text };
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    finishAnalysis();
                    displayResults(data);
                })
                .catch(error => {
                    finishAnalysis();
                    let errorMessage = 'Analysis failed';
                    if (error.status) {
                        errorMessage = `API Error ${error.status}: ${error.statusText}`;
                        if (error.body) {
                            errorMessage += ` - ${error.body}`;
                        }
                    } else if (error.message) {
                        errorMessage = `Network Error: ${error.message}`;
                    }
                    updateStatus(errorMessage, 'error');
                });
        });
    }

    function startAnalysis() {
        analyzeBtn.disabled = true;
        updateBtnText('<span class="loading-spinner"></span>Analyzing...');
        updateStatus('Analyzing project outcomes...', 'info');
        hideResults();
    }

    function finishAnalysis() {
        analyzeBtn.disabled = false;
        updateBtnText('Analyze Current Project');
    }

    function updateBtnText(text) {
        btnText.innerHTML = text;
    }

    function updateStatus(message, type = 'info') {
        statusDiv.innerHTML = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
    }

    function hideStatus() {
        statusDiv.style.display = 'none';
    }

    function hideResults() {
        resultsDiv.style.display = 'none';
        statsGrid.style.display = 'none';
    }

    function displayResults(data) {
        const outcomes = data.outcomes_analysis || [];

        // summary
        const totalOutcomesCount = outcomes.length;
        const classifiedAsSoftware = outcomes.filter(o =>
            o.classification && o.classification.predicted_class === "1"
        ).length;

        const successfullyExtracted = outcomes.filter(o => {
            const isSoftware = o.classification && o.classification.predicted_class === "1";
            const hasValidOutput = o.final_output &&
                typeof o.final_output === 'string' &&
                o.final_output.trim().length > 0 &&
                !o.final_output.trim().toLowerCase().includes('no information') &&
                !o.final_output.trim().toLowerCase().includes('not available') &&
                !o.final_output.trim().toLowerCase().includes('no extractable entities') &&
                o.final_output.trim() !== 'null' &&
                o.final_output.trim() !== 'None';

            return isSoftware && hasValidOutput;
        }).length;

        const extractionSuccessRate = classifiedAsSoftware > 0 ?
            Math.round((successfullyExtracted / classifiedAsSoftware) * 100) : 0;

        // update summary cards
        totalOutcomes.textContent = totalOutcomesCount;
        detectedCount.textContent = classifiedAsSoftware;
        extractedCount.textContent = successfullyExtracted;
        successRate.textContent = `${extractionSuccessRate}%`;

        // show summary result
        statsGrid.className = 'stats-grid four-cards';
        statsGrid.style.display = 'grid';

        const softwareOutcomes = outcomes.filter(o => {
            const isSoftware = o.classification && o.classification.predicted_class === "1";
            const hasValidOutput = o.final_output &&
                typeof o.final_output === 'string' &&
                o.final_output.trim().length > 0 &&
                !o.final_output.trim().toLowerCase().includes('no information') &&
                !o.final_output.trim().toLowerCase().includes('not available') &&
                !o.final_output.trim().toLowerCase().includes('no extractable entities') &&
                o.final_output.trim() !== 'null' &&
                o.final_output.trim() !== 'None';

            return isSoftware && hasValidOutput;
        });

        if (softwareOutcomes.length > 0) {
            let statusMessage = `Analysis complete! `;
            if (classifiedAsSoftware > successfullyExtracted) {
                statusMessage += `Found ${successfullyExtracted} software products (from ${classifiedAsSoftware} potential matches).`;
            } else {
                statusMessage += `Found ${successfullyExtracted} software products.`;
            }
            updateStatus(statusMessage, 'success');

            resultsTitle.textContent = `Software Products Found (${successfullyExtracted})`;
            resultsContent.innerHTML = '';

            // add suammary info
            const statsInfo = document.createElement('div');
            statsInfo.className = 'analysis-summary';
            statsInfo.innerHTML = `
                <div class="summary-title">Analysis Summary</div>
                <div class="summary-content">
                    • Classifier identified <strong>${classifiedAsSoftware}</strong> outcomes as potentially containing software<br>
                    • Successfully extracted detailed information from <strong>${successfullyExtracted}</strong> of these<br>
                    • Extraction success rate: <strong>${extractionSuccessRate}%</strong>
                    ${classifiedAsSoftware > successfullyExtracted ?
                    `<br>• <em>${classifiedAsSoftware - successfullyExtracted} potential matches had insufficient detail for extraction</em>`
                    : ''}
                </div>
            `;
            resultsContent.appendChild(statsInfo);

            const archiveInfo = document.createElement('div');
            archiveInfo.className = 'archive-tip';
            archiveInfo.innerHTML = `
                <div class="archive-tip-text">
                    Tip: Each link includes an "Archive" option to view historical versions via Internet Archive.
                    Use this if the original link is no longer accessible.
                </div>
            `;
            resultsContent.appendChild(archiveInfo);

            softwareOutcomes.forEach((outcome, index) => {
                const item = createSoftwareItem(outcome, index + 1);
                resultsContent.appendChild(item);
            });

            resultsDiv.style.display = 'block';
        } else {
            let statusMessage = 'Analysis complete. ';
            if (classifiedAsSoftware > 0) {
                statusMessage += `Classisfer identified ${classifiedAsSoftware} potential software-related outcomes, but none contained sufficient detail for extraction.`;
            } else {
                statusMessage += 'No software-related outcomes were identified.';
            }
            updateStatus(statusMessage, 'info');

            resultsTitle.textContent = 'Analysis Results';
            resultsContent.innerHTML = `
                <div class="no-results">
                    <h4 style="color: #333; margin-bottom: 15px;">No Extractable Software Products Found</h4>
                    ${classifiedAsSoftware > 0 ? `
                        <p>The classifier identified <strong>${classifiedAsSoftware}</strong> outcomes as potentially software-related, 
                        but they didn't contain enough specific information (like names, URLs, or detailed descriptions) to extract as software products.</p>
                        <p style="margin-top: 15px; font-size: 12px; color: #999;">
                            This could mean the outcomes mention software tools in passing, or refer to software development without providing specific details.
                        </p>
                    ` : `
                        <p>This project appears to focus on other types of research outputs such as publications, datasets, or theoretical contributions.</p>
                    `}
                </div>
            `;
            resultsDiv.style.display = 'block';
        }

        setTimeout(() => {
            resultsDiv.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }

    function createSoftwareItem(outcome, index) {
        const item = document.createElement('div');
        item.className = 'software-item';

        const softwareName = extractSoftwareName(outcome.final_output);
        const description = outcome.final_output;
        const urls = extractUrls(outcome.final_output);

        let urlsHtml = '';
        if (urls.length > 0) {
            urlsHtml = urls.map(url => {
                return `
                    <div style="margin: 5px 0; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                        <a href="${url}" target="_blank" class="software-url primary-link">${url}</a>
                        <button class="archive-btn" data-url="${url}" style="margin-left: 10px; padding: 3px 8px; font-size: 10px; background: rgba(255,152,0,0.2); color: #e65100; border: none; border-radius: 3px; cursor: pointer;">
                            Check Archive
                        </button>
                        <div class="archive-result" style="margin-top: 5px; display: none;"></div>
                    </div>
                `;
            }).join('');
        }

        item.innerHTML = `
            <div class="software-name">${index}. ${softwareName}</div>
            <div class="software-details">${description}</div>
            <div class="links-container">
                ${urlsHtml}
            </div>
        `;

        item.querySelectorAll('.archive-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const url = btn.dataset.url;
                const resultDiv = btn.parentElement.querySelector('.archive-result');

                btn.disabled = true;
                btn.textContent = 'Checking...';
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = 'Searching Internet Archive...';

                try {
                    const archiveResult = await checkArchive(url);
                    displayArchiveResult(resultDiv, archiveResult);
                } catch (error) {
                    resultDiv.innerHTML = 'Error checking archive.';
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Check Archive';
                }
            });
        });

        return item;
    }

    // Internet Archive API integration
    async function checkArchive(url) {
        try {
            const archiveApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
            const response = await fetch(archiveApiUrl);

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
                        found: true,
                        url: snapshot.url,
                        date: archiveDate,
                        timestamp: snapshot.timestamp
                    };
                }
            }

            return { found: false };
        } catch (error) {
            throw new Error('Failed to check archive');
        }
    }

    // Archive result display handler
    function displayArchiveResult(container, result) {
        if (result.found) {
            container.innerHTML = `
                <div style="padding: 5px; background: rgba(255,152,0,0.1); border-left: 3px solid #ff9800; border-radius: 3px;">
                    <div style="font-size: 11px; color: #e65100; margin-bottom: 3px;">
                        Archive found from ${result.date}
                    </div>
                    <a href="${result.url}" target="_blank" style="font-size: 11px; color: #e65100; text-decoration: none;">
                        View Archived Version →
                    </a>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="padding: 5px; background: rgba(158,158,158,0.1); border-left: 3px solid #9e9e9e; border-radius: 3px;">
                    <div style="font-size: 11px; color: #757575;">
                        No archived version found
                    </div>
                </div>
            `;
        }
    }

    // Software name extraction with URL cleanup
    function extractSoftwareName(text) {
        if (!text) return 'Software Product';

        // Handle semicolon-separated format: "Name; https://..."
        const semicolonIndex = text.indexOf(';');
        if (semicolonIndex !== -1) {
            let name = text.substring(0, semicolonIndex).trim();
            name = name.replace(/\s+(https?|www)$/i, '').trim();
            if (name.length > 0 && name.length <= 80) {
                return name;
            }
        }

        // Try colon separation
        const colonMatch = text.match(/^([^:]{1,80}):/);
        if (colonMatch) {
            let name = colonMatch[1].trim();
            name = name.replace(/\s+(https?|www)$/i, '').trim();
            return name;
        }

        // Try dash separation
        const dashMatch = text.match(/^([^-]{1,80})\s*-/);
        if (dashMatch) {
            let name = dashMatch[1].trim();
            name = name.replace(/\s+(https?|www)$/i, '').trim();
            return name;
        }

        // Fallback: use first sentence, clean URLs
        const firstPart = text.split(/[.!?]/)[0];
        let cleanedPart = firstPart.replace(/https?:\/\/[^\s]+/gi, '').trim();

        if (cleanedPart.length === 0) {
            cleanedPart = firstPart.trim();
        }

        return cleanedPart.length > 80 ? cleanedPart.substring(0, 80) + '...' : cleanedPart;
    }

    // URL extraction from text
    function extractUrls(text) {
        if (!text) return [];

        const urlRegex = /https?:\/\/[^\s<>"']+/gi;
        const matches = text.match(urlRegex) || [];

        return [...new Set(matches.map(url => url.replace(/[.,;)]$/, '')))];
    }
});