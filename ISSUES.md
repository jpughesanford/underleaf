## checklist
  
- [x] settings should be accesible from inside the project as well. Put it to the left of the save button. 
- [x] folders should be collapsed by default on enter 
- [x] right clicking on an untracked file in the git panel should pop up with "Add to gitignore" and "Delete". Delete should also be added when right clicking a file in the explorer. 
- [x] add buttons on divs that allow you to autocollapse them, like in overleaf. 
- [x] next to the save drop down menu, add a "view PDF / view Source / view Both" drop down, that focuses on one div over another. 
- [ ] Allow users to drag files into the file explorer. behind the scenes, this copies the dragged file into the folder they hover over
- [ ] should be able add new file, add new folder, and drag files around in the file explorer. 
- [x] if the system has never compiled, as there is an error, the error panel wont show you what went wrong. it just says failed. 
- [x] auto detected root file is not visually specified. "root" only appeared once manually selected. 
- [x] .DS_store and .underleaf show up in git panel as things to push. these should be ignored, no?
- [x] logo too close to the red,yellow,green buttons in the top left. give the logo and name "Underleaf" some horizontal room to breath
- [x] auxillery files should all be moved to some hidden folder upon compile, and made sure to be ignored for git operations, etc. 
- [x] click on compile tab error to jump to error, and hilight erroneous line as red in editor. 
- [x] LiveTex not found in distribution release of app. its only found using npm build dev
- [x] the pdf viewer is very difficult to interact with. The pdf pages are stretched, you can continuous scroll. Please make more similar to overleaf. 
    - [x] When you run compile, the new pdf doenst automatically show up, you have to reload to show it
    - [x] you have to save all documents before you press compile, or else it thinks nothing has changed and doesnt do anything. maybe auto save on compile?