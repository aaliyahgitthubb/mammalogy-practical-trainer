# Mammalogy Practical Trainer — hosted version

This folder is ready to publish as a static website (for example with GitHub Pages). It includes a PWA manifest and service worker so the trainer can be installed in Opera and receive application updates without replacing your personal study data.

## One-time setup
1. Create a GitHub account at https://github.com/ if you do not already have one.
2. Create a new repository named `mammalogy-practical-trainer`. With GitHub Free, make it public.
3. Upload the contents of THIS folder to the repository root. Make sure `index.html` is at the top level.
4. In the repository, open Settings → Pages. Under Build and deployment, choose Deploy from a branch, select `main` and `/ (root)`, then Save.
5. GitHub will publish the site. The Pages URL will be shown in Settings → Pages. Initial publication can take several minutes.
6. Open the published URL in Opera.
7. In Opera, use the browser's Install/Add to desktop option if offered to install the PWA.

## Future updates
Replace/update the website files in the GitHub repository. GitHub Pages republishes changes. The service worker checks for a new version and can show an Update now button. Your IndexedDB/localStorage study data is stored separately in the browser.

## Important privacy note
The built-in course images and app files are public if this repository/site is public. Do not put private or sensitive information into the repository. Your custom study data is stored locally in each browser and is not uploaded by this app. GitHub Pages itself logs visitor IP addresses for security, according to GitHub documentation.

## Existing local data
The old local trainer and this hosted version use the same database names, but browser storage is origin-specific. Export a backup from the old trainer and import it into the hosted site once. Keep the old trainer until you verify the transfer.
