# Design notes

## Idea

The player never picks a weapon from a menu. They draw it. The drawing decides three things:

* **What** is forged, from the shape of the stroke.
* **Where** it appears, from the place on screen the stroke was drawn.
* **How strong** it is, from how cleanly the shape was drawn.

## Reading a stroke (`gesture.js`)

1. The stroke is resampled to 64 evenly spaced points, so fast and slow drawing look the same.
2. A very small stroke is a tap. A stroke whose ends are far apart but nearly as long as its path is a line.
3. A stroke that comes back to its start is a closed shape. Its roundness, `4πA / P²`, is 1 for a
   perfect circle, about 0.79 for a square and about 0.6 for a triangle.
4. Shapes that are not round enough to be circles are split by counting corners with
   Ramer Douglas Peucker simplification. The join between the end and the start counts as a
   corner only when the outline really bends there, because people start closed shapes in the
   middle of a side.
5. An open stroke with two or more bends is a zigzag.

Clarity is how close the stroke came to the ideal value for its shape. It scales power from 0.6 to 1.2,
with a bonus for a perfect form.

## From screen to island (`game.js`)

Each stroke point becomes a ray from the camera. The ray is marched over the height field and the
hit is refined by bisection. From the hits the game takes:

* the center of the construct,
* its size, from the average distance of the stroke to that center,
* a start and end point, used as the direction of a Lance.

Whether a circle is drawn around Vey is judged on screen, not on the ground. The ground is seen at a
slant, so a circle that looks round to the player covers a long oval on the island.

## Physics

Everything is a body with position and velocity on a height field. Trees, rocks and pillars are
circles. Walls are boxes with a yaw. One `solid` function pushes any body out of all of them, and
one `floorAt` function returns the ground or the top of a wall, which is how walls become stairs.

## Foes

| Foe | Behaviour |
| --- | --- |
| Hollow | Floats straight at Vey and strikes up close |
| Spitter | Keeps its distance, circles, and fires orbs that walls and the Aegis can stop |
| Brute | Slow, heavy, and charges in a straight line when close |

Foes knocked past the rim of the island fall and count as a ring out.

## Tests

`npm test` runs unit tests for the stroke reader and for every construct, then a bot plays both
modes for several minutes of game time with random drawings and fails on any error or bad number.
