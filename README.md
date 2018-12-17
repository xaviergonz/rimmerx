# rimmerx

TODO:

- async update transaction? but that could lock the whole store for a long time...
- action capturing? middleware? woud need to give names to updates (better for lenses?)
- react stuff
- support subscribeToPatches for non root cursors?
- cancel inside actions?
- cache lens getters?
- subscribe for lenses? (would be the same as subscribing for its inner cursor actually)

- instead of lens.\_ .\$ use getCursor(lens), getData(lens) ?
