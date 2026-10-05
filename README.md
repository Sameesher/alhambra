# Alhambra Virtual Tour

Interactive floor-plan tour of the Alhambra Palace for the Roadrunners Realty AP Art History presentation.
Plain HTML/CSS/JS, no build step.

## Run locally
python3 -m http.server 4173   # then open http://localhost:4173

## Deploy to Vercel
npx vercel          # first time: log in, accept defaults (no framework, no build command)
npx vercel --prod   # publish the production URL

Link straight to a stop with a hash, e.g. /#lions, /#sisters, /#generalife.
Arrow keys move between stops.

## 3D walkthrough (/3d)
Three.js scene (loaded from the jsDelivr CDN, no install). A tour-guide character walks the route
Mexuar → Court of the Myrtles → Hall of the Ambassadors → Court of the Lions → Hall of the Two Sisters → Generalife.
Controls: Start/Continue, ← → to jump between stops, Space to pause, C for free look (drag/scroll).
The model is a schematic reconstruction: real layout and features, simplified geometry.
