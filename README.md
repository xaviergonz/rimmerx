# rimmerx

TODO:

- do we really want nested updates possible?
- async update transaction? but that could lock the whole store for a long time...
- action capturing? middleware? woud need to give names to updates (better for lenses?)
- react stuff
- support subscribeToPatches for non root cursors?
- cancel inside actions?
- cache lens getters?

* update should support some functional cursors, for example the ones that use find and filter...
  - but it seems it is not supported by immer :(
