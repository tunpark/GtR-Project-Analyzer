# GtR Project Analyzer

GtR Project Analyzer is a Chrome browser extension designed to enhance the experience of browsing the **UKRI Gateway to Research (GtR)** website. It provides an intelligent side panel that analyzes research project outcomes to automatically detect and extract information about software products, complete with a lookup feature for archived versions of project links.

## Features

* **Intelligent Software Detection**: Utilizes an AI model hosted on Hugging Face Spaces to analyze the text of project outcomes and identify those that are likely related to software.
* **Detailed Analysis Summary**: Presents a clear, quantitative summary in the side panel, including:
    * The total number of software-related outcomes found.
    * How many were initially detected by the AI.
    * How many contained enough detail to be successfully extracted.
    * The overall extraction success rate.
* **Information Extraction**: Extracts the names, descriptions, and associated URLs of identified software products.
* **Internet Archive Integration**: For every extracted URL, the extension includes a button to check for a saved version on the Internet Archive's Wayback Machine. This is crucial for accessing resources from links that are no longer live (link rot).
* **Seamless Integration**: The extension's side panel automatically activates on GtR project pages, providing a non-intrusive and context-aware user experience.

## How It Works

The extension operates through a combination of a front-end side panel and a powerful back-end service:

1.  **Page Detection**: The `background.js` script detects when the user navigates to a GtR project page (`gtr.ukri.org`).
2.  **User Action**: The user clicks the "Analyze Current Project" button in the `sidepanel.html`.
3.  **API Request**: `sidepanel.js` extracts the project reference ID from the current URL and sends an API request to a dedicated back-end service hosted on **Hugging Face Spaces**.
4.  **Back-end Analysis**: The Hugging Face service performs the heavy lifting:
    * It scrapes the project page for all outcome descriptions.
    * A text classification model predicts which outcomes are software-related.
    * A Named Entity Recognition (NER) model extracts specific details (software names, URLs) from the positive outcomes.
5.  **Display Results**: The analysis results are sent back to the side panel, which then dynamically renders a detailed summary and a list of the extracted software products.
6.  **Archive Lookup**: When the user clicks a "Check Archive" button, `sidepanel.js` sends a request to the public Internet Archive API to find the closest available snapshot of the original URL.

## Installation

Since this is an unpacked extension, you can install it in any Chromium-based browser (like Google Chrome, Microsoft Edge, Brave, etc.) by following these steps:

1.  **Download the Repository**: Download the project files and unzip them to a permanent location on your computer.
2.  **Open Extensions Page**: Open your browser and navigate to the extensions management page. You can usually find this at `chrome://extensions` or `edge://extensions`.
3.  **Enable Developer Mode**: Find and turn on the "Developer mode" toggle, which is typically located in the top-right corner of the page.
4.  **Load Unpacked**: Click the "Load unpacked" button that appears.
5.  **Select Folder**: In the file selection dialog, navigate to and select the folder where you saved the project files (the folder containing `manifest.json`).
6.  **Done**: The GtR Project Analyzer extension should now appear in your list of installed extensions and be ready to use.

## Usage

1.  Navigate to any project page on the Gateway to Research website (e.g., `https://gtr.ukri.org/projects?ref=...`).
2.  Click on the extension icon in your browser's toolbar, or simply open the browser's side panel. The GtR Project Analyzer should appear automatically.
3.  The side panel will display the current project's reference number.
4.  Click the **"Analyze Current Project"** button to begin the analysis.
5.  View the summary and the list of extracted software products directly in the side panel.

## Project Structure

This repository contains the essential files for a Chrome extension:

* **`manifest.json`**: The core configuration file for the extension. It defines the name, version, permissions, and specifies the scripts and files to be used.
* **`sidepanel.html`**: The HTML file that defines the structure and layout of the user interface displayed in the browser's side panel.
* **`sidepanel.js`**: The main JavaScript logic for the side panel. It handles user interactions, communicates with the back-end service, and dynamically updates the HTML to display results.
* **`background.js`**: The service worker for the extension. It runs in the background to detect when to open the side panel and manages other browser-level events.
* **`icons/`**: A directory containing the icons used for the extension in various sizes.
