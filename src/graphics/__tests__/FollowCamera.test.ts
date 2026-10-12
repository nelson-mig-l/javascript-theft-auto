import { describe, expect, it } from 'vitest';
import { approachAngle, computeFollowCameraPose } from '../FollowCamera';

describe('follow camera', () => {
  it('sits above and behind the target, looking ahead of its travel', () => {
    const pose = computeFollowCameraPose([10, 4, 20], 0, 10);

    expect(pose.target).toEqual([10, 4, 23.5]);
    expect(pose.position[0]).toBeCloseTo(10);
    expect(pose.position[1]).toBeGreaterThan(4 + 15);
    expect(pose.position[2]).toBeLessThan(20);
  });

  it('turns through the shortest arc', () => {
    expect(approachAngle(3, -3, 1)).toBeCloseTo(2 * Math.PI - 3);
    expect(approachAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});
