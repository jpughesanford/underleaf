## checklist
  
### Major
- [x] LiveTex not found in distribution release of app. its only found using npm build dev
- [ ] the pdf viewer is very difficult to interact with. The pdf pages are stretched, you can continuous scroll. Please make more similar to overleaf. 
    - [ ] When you run compile, the new pdf doenst automatically show up, you have to reload to show it
    - [ ] you have to save all documents before you press compile, or else it thinks nothing has changed and doesnt do anything. maybe auto save on compile?
- [] there is no settings once inside the project. Nowhere to pick root file etc. 

### Minor
- [ ] auto detected root file is not visually specified. "root" only appeared once manually selected. 
- [ ] logo too close to the red,yellow,green buttons in the top left. give the logo and name "Underleaf" some horizontal room to breath
- [ ] auxillery files should all be moved to some hidden folder upon compile, and made sure to be ignored for git operations, etc. 
- [ ] click on compile tab error to jump to error, and hilight erroneous line as red in editor. 
- [ ] folders should be collapsed by default on enter 
- [ ] right clicking on an untracked file in the git panel should pop up with "Add to gitignore" and "Delete". Delete should also be added when right clicking a file in the explorer. 
- [ ] add buttons on divs that allow you to autocollapse them, like in overleaf. 
- [ ] next to the save drop down menu, add a "view PDF / view Source / view Both" drop down, that focuses on one div over another. 
- [ ] Allow users to drag files into the file explorer, and copy the dragged file into the folder they hover over