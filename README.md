# Infinite Hash Terrain
Infinite terrain using procedural generation, with zero memory footprint.

This is just an experiment to see what more I can do with
the hash function that was used in my
[Infinite Hash Maze](https://github.com/helderman/infinite-hash-maze).

The terrain is completely recalculated for every frame.
For each frame, we recalculate every individual pixel.
And for each pixel, we need multiple hash calculations
to get a certain level of detail in the terrain.
The implementations below use 51 hashes per pixel.

Of course this results in a big CPU load, especially on high resolutions.
But it potentially scales very well, because:

- it can be parallelized
- CPU load is independent of zoom factor (unless we cache hashes)

## WebGL2 implementation

With calculations running in parallel on the GPU,
you may be able to run this animation full-screen at 60 frames per second.

[https://helderman.github.io/infinite-hash-terrain/webgl/terrain.html](https://helderman.github.io/infinite-hash-terrain/webgl/terrain.html)

## WebGL1 implementation

In case you cannot use WebGL2, gear back to WebGL1.
It will be slower, due to a suboptimal hash calculation.

[https://helderman.github.io/infinite-hash-terrain/webgl/terrain.html#1](https://helderman.github.io/infinite-hash-terrain/webgl/terrain.html#1)

## JavaScript implementation

This is the slowest implementation,
with all calculations being performed on the CPU.
Even the fastest processors will have trouble running this full-screen
at more than one frame per second.

[https://helderman.github.io/infinite-hash-terrain/html5/terrain.html](https://helderman.github.io/infinite-hash-terrain/html5/terrain.html)
