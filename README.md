<p align="center">
  <img src="./icon-128.png" alt="Atlas Sidebar" width="96" height="96">
</p>

<h1 align="center">Atlas Sidebar</h1>

<p align="center"><strong>A workspace for web context and saved prompts</strong></p>

<p align="center">
  Collect text, links, screenshots, documents, and video transcripts while you browse—then review, copy, download, or add them to ChatGPT when you are ready.
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

> Atlas Sidebar is an unofficial personal project. It is not affiliated with or endorsed by OpenAI, ChatGPT, Atlas, YouTube, or Bilibili.

## Demo

https://github.com/user-attachments/assets/27f3408b-ca9c-4bcb-89c2-bb6a1436332f

## Why this project exists

OpenAI has announced that Atlas is scheduled to stop working on **August 9, 2026**, as its browser-based agentic capabilities evolve into ChatGPT. See the official Help Center notice: [Evolving Atlas into ChatGPT for browser-based agentic work](https://help.openai.com/en/articles/20001371-evolving-atlas-into-chatgpt-for-browser-based-agentic-work).

One part of the Atlas browser that I especially valued was its sidebar. It let me keep ChatGPT next to the page I was reading and quickly bring useful context into a conversation without breaking my flow.

What worried me was not losing account data, bookmarks, or other browser state that can be exported or rebuilt. It was losing the workflow itself: highlight a passage, capture a figure, download a paper, extract a video transcript, and combine material from several pages before asking one good question. Each step is simple, but repeating the handoffs dozens of times a day interrupts both reading and thinking.

OpenAI has since released a [ChatGPT Chrome extension](https://learn.chatgpt.com/docs/chrome-extension) for browser tasks that need signed-in browser state, allowing ChatGPT to read or act on websites during a task. It is powerful, but its interaction model is still different from the Atlas workflow I relied on: keeping ChatGPT beside the page while I deliberately collect material across multiple sources, review it in a local staging area, and decide what to send and when.

Atlas Sidebar is an independent attempt to preserve that workflow. It does not recreate the entire Atlas browser and it never sends a prompt on your behalf. It restores one deliberate, user-controlled loop:

**Collect from the current page → keep it in a local staging area → review and select → copy, download, or add to ChatGPT.**

## What it can do

- **Sidebar browser:** Open a URL inside Chrome Side Panel, with ChatGPT as the default. The address bar, history navigation, and embedded page state stay in sync; **Open in tab** launches the exact current sidebar URL in a new normal tab.
- **Saved pages and recent visits:** Save the current sidebar page, give it a custom name, search it, and batch-select or delete entries so you can move quickly between conversations and tasks.
- **Persistent staging area:** Collect course material, papers, screenshots, and transcripts across multiple webpages. Switching tabs, closing the side panel, reloading the extension, or restarting Chrome does not clear the draft; only you can remove it.
- **Text and links:** Highlight text and click the small “+” beside the selection, use the context menu, or save the current page link directly.
- **Screenshots and documents:** Capture the visible page, extract readable webpage content, fetch a remote PDF, or choose a local file. PDFs and images remain original files rather than being flattened into plain text.
- **YouTube and Bilibili transcripts:** Detect whether real transcript tracks exist, distinguish manual and auto-generated tracks, and export TXT/VTT files. Transcripts are added to ChatGPT as document attachments; unavailable, restricted, and failed states are reported separately instead of generating fake text.
- **Saved prompts:** Store reusable prompts with optional `{variable}` fields. Fill variables in the sidebar or leave placeholders for editing in ChatGPT, and import or export the library as local JSON.
- **Three ways out:** Copy selected material to the clipboard for any AI or app, download it locally, or explicitly add it to the current ChatGPT composer or attachment area.
- **Personalization:** Choose the interface language, preferred transcript language, draggable capture-tool order, light or dark mode, and a top-bar color theme.

## Installation

Atlas Sidebar currently runs as a local unpacked Chrome extension and is not distributed through the Chrome Web Store.

1. Download the latest `Atlas-Sidebar-v*.zip` from [GitHub Releases](https://github.com/Johnny-xuan/Atlas-Sidebar/releases/latest).
2. Unzip it. You will get an `atlas-sidebar` folder; move that folder to a stable location that will not be renamed or deleted.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode** in the upper-right corner.
5. Click **Load unpacked** and select the `atlas-sidebar` folder.
6. Click the Atlas Sidebar icon in the browser toolbar to open the side panel.
7. To read local `file://` PDFs, open the extension details page and enable **Allow access to file URLs**.

To use ChatGPT inside the sidebar, first sign in to [chatgpt.com](https://chatgpt.com/) in a normal tab under the **same Chrome profile**. The extension uses the browser's existing signed-in session; it does not save or export your cookies, tokens, password, or account credentials.

### Updating

Always update the same `atlas-sidebar` folder so the extension keeps the same local identity and retains your settings, saved prompts, saved pages, and recent visits:

1. Download and unzip the new version.
2. Replace the files inside your existing `atlas-sidebar` folder. Do not switch to a different folder path.
3. Return to `chrome://extensions` and click **Reload** on the Atlas Sidebar card.

Staged material, settings, saved prompts, saved pages, and recent visits are stored locally. They survive updates to the same extension directory, extension reloads, and Chrome restarts. Draft material does not expire automatically; remove individual items or use **Clear** when you are finished. Uninstalling the extension deletes this local data, so export important prompts as JSON from Settings first.

## Basic workflow

Keep browsing on the left while ChatGPT or another task page remains open in Atlas Sidebar on the right:

1. Highlight text across different webpages and click the “+” beside the selection. You can also collect links, screenshots, documents, transcripts, and saved prompts.
2. Review everything in the persistent staging area and select only the material you want to use.
3. Choose **Copy selected**, **Download selected**, or **Add to ChatGPT**.
4. Material added to ChatGPT remains a draft. Review it and send the message yourself.

## Privacy and security

- No API key is required. Atlas Sidebar has no remote backend, telemetry, or advertising.
- Page content is read only after an explicit user action and stored in the current browser's extension storage or IndexedDB. Atlas Sidebar has no server and does not automatically upload this data anywhere.
- Saved prompts, appearance settings, and page lists remain on the local device.
- The extension never sends a ChatGPT message automatically and does not read passwords saved by the browser.
- To embed a user-entered URL in the side panel, the extension temporarily adjusts iframe-protection response headers for that specific domain. The corresponding rules are removed when you leave the page or close the side panel.

## Known limitations

- Some websites refuse to run inside an iframe through scripts, login redirects, popups, or browser policy. Use **Open in tab** in those cases.
- Changes to ChatGPT, YouTube, or Bilibili pages and platform endpoints may temporarily affect content transfer or transcript extraction.
- Local PDFs require **Allow access to file URLs**. You can also use the **Local file** capture button without granting that permission.
- Auto-generated transcripts come from the video platform's existing speech-recognition results. Atlas Sidebar does not run its own speech-to-text model on the video.

## Compatibility

Current version: `0.28.0`<br>
Verified environment: Chrome/Chromium (Manifest V3)

## License

Atlas Sidebar is released under the [MIT License](./LICENSE).
