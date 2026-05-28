
## TODO 

- [ ] brightness window can extend beyond the app window, moving off screen. 
- [ ] can we add the "Find in PDF" and "Find in Source" buttons that over leaf has that jump between the editor and pdf?
- [ ] selecting a file in the git panel should open the file with all git changes hi lighted. The PDF does not need to be here in the git panel. We can show the old file in a left editor and the new file in the right editor. 
- [ ] add spell check to editor. 
- [ ] compile.ts's readPdf returns the entire PDF as an ArrayBuffer over IPC on every preview. Fine for normal documents; large PDFs get fully copied through the bridge each compile. This was logged as a "note for later" — a future streaming/file-URL approach
- [] in the git panel, the amend button is not very visible in light mode. its not readable. 
- [] in the find and replace panel, make the all button the same color as the replace button. 