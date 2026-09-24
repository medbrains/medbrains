import { describe, expect, it } from "vitest";
import { classifyBoardFrame } from "./TokenBoardLive";

/**
 * One socket carries two shapes. A queue event is tagged; an announcement is
 * not, so a board that only looked at `type` dropped every emergency code —
 * the message reached every screen in the hospital and lit up none of them.
 */
describe("classifyBoardFrame", () => {
  it("reads a called token", () => {
    const frame = classifyBoardFrame({
      type: "token_called",
      token_number: "A-42",
      room: "Room 3",
    });
    expect(frame).toEqual({ kind: "token", tokenNumber: "A-42", where: "Room 3" });
  });

  it("reads an untagged announcement as the alert it is", () => {
    const frame = classifyBoardFrame({
      id: "abc",
      message: "CODE BLUE — Ward 3B",
      priority: "emergency",
    });
    expect(frame).toEqual({
      kind: "alert",
      alert: { id: "abc", message: "CODE BLUE — Ward 3B", priority: "emergency" },
    });
  });

  it("ignores the frames that are neither, rather than guessing", () => {
    expect(classifyBoardFrame({ type: "token_status_changed", status: "waiting" }).kind).toBe(
      "ignore",
    );
    expect(classifyBoardFrame(null).kind).toBe("ignore");
    expect(classifyBoardFrame("pong").kind).toBe("ignore");
    // A message with no priority is not an announcement this board can rank.
    expect(classifyBoardFrame({ message: "hello" }).kind).toBe("ignore");
  });
});
