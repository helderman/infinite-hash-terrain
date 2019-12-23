# Infinite Hash Terrain
Infinite terrain using procedural generation, with zero memory footprint.

This is just an experiment to see what more I can do with
the hash function that was used in my
[Infinite Hash Maze](https://github.com/helderman/infinite-hash-maze).

The terrain is completely recalculated for every frame.
For each frame, we recalculate every individual pixel.
And for each pixel, we need multiple hash calculations
to get a certain level of detail in the terrain.
The implementation below calculates 39 hashes per pixel.

Of course this results in a big CPU load, especially on high resolutions.
But it potentially scales very well, because:

- it can be parallelized
- CPU load is independent of zoom factor (unless we cache hashes)

## JavaScript implementation

Go here to freely browse through the terrain:   
[https://helderman.github.io/infinite-hash-terrain/html5/terrain.html](https://helderman.github.io/infinite-hash-terrain/html5/terrain.html)
