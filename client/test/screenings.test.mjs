import { test } from "node:test";
import assert from "node:assert";
import { SCREENINGS, scoreScreening, nextQuestion, previousQuestion, askedCount, maxScore } from "../src/lib/screenings.js";

const { depression, anxiety, alcohol } = SCREENINGS;

test("published maximum scores: PHQ-9 27, GAD-7 21, AUDIT 40", () => {
  assert.strictEqual(maxScore(depression), 27);
  assert.strictEqual(maxScore(anxiety), 21);
  assert.strictEqual(maxScore(alcohol), 40);
});

test("PHQ-9 bands follow the published cut-offs (5, 10, 15, 20)", () => {
  const band = (score) => {
    // Spread the score over the first eight items, leaving item 9 at 0.
    const answers = Array(9).fill(0);
    for (let i = 0, left = score; left > 0; i = (i + 1) % 8) {
      if (answers[i] < 3) {
        answers[i]++;
        left--;
      }
    }
    return scoreScreening(depression, answers).band.label;
  };
  assert.strictEqual(band(4), "Minimal");
  assert.strictEqual(band(5), "Mild");
  assert.strictEqual(band(10), "Moderate");
  assert.strictEqual(band(15), "Moderately severe");
  assert.strictEqual(band(20), "Severe");
});

test("any answer above 'Not at all' on PHQ-9 item 9 flags crisis support, whatever the total", () => {
  const answers = [0, 0, 0, 0, 0, 0, 0, 0, 1];
  const result = scoreScreening(depression, answers);
  assert.strictEqual(result.band.label, "Minimal");
  assert.strictEqual(result.crisis, true);
  assert.strictEqual(scoreScreening(depression, Array(9).fill(0)).crisis, false);
});

test("GAD-7 bands follow the published cut-offs (5, 10, 15)", () => {
  assert.strictEqual(scoreScreening(anxiety, [0, 0, 0, 0, 0, 0, 4]).band.label, "Minimal");
  assert.strictEqual(scoreScreening(anxiety, [3, 2, 0, 0, 0, 0, 0]).band.label, "Mild");
  assert.strictEqual(scoreScreening(anxiety, [3, 3, 3, 1, 0, 0, 0]).band.label, "Moderate");
  assert.strictEqual(scoreScreening(anxiety, [3, 3, 3, 3, 3, 0, 0]).band.label, "Severe");
});

test("AUDIT: 'Never' drinking ends the questionnaire with a score of 0", () => {
  const answers = [0];
  assert.strictEqual(nextQuestion(alcohol, answers, 0), -1);
  assert.strictEqual(askedCount(alcohol, answers), 1);
  assert.strictEqual(scoreScreening(alcohol, answers).score, 0);
});

test("AUDIT: the question count starts at 10 and only shrinks once a skip applies", () => {
  assert.strictEqual(askedCount(alcohol, []), 10);
  assert.strictEqual(askedCount(alcohol, [1]), 10);
  assert.strictEqual(askedCount(alcohol, [1, 0]), 10);
  assert.strictEqual(askedCount(alcohol, [1, 0, 0]), 5);
});

test("AUDIT: if questions 2 and 3 score 0, it skips to question 9", () => {
  const answers = [1, 0, 0];
  assert.strictEqual(nextQuestion(alcohol, answers, 2), 8);
  assert.strictEqual(previousQuestion(alcohol, answers, 8), 2);
  assert.strictEqual(askedCount(alcohol, answers), 5);
  // Stale answers to skipped questions don't count.
  assert.strictEqual(scoreScreening(alcohol, [1, 0, 0, 4, 4, 4, 4, 4, 0, 0]).score, 1);
});

test("AUDIT zones: 8 increasing risk, 16 higher risk, 20 possible dependence", () => {
  assert.strictEqual(scoreScreening(alcohol, [2, 1, 1, 1, 1, 0, 1, 0, 0, 0]).band.label, "Lower risk");
  assert.strictEqual(scoreScreening(alcohol, [3, 1, 1, 1, 1, 0, 1, 0, 0, 0]).band.label, "Increasing risk");
  assert.strictEqual(scoreScreening(alcohol, [4, 2, 2, 2, 2, 0, 2, 0, 2, 0]).band.label, "Higher risk");
  assert.strictEqual(scoreScreening(alcohol, [4, 3, 3, 2, 2, 2, 2, 2, 0, 0]).band.label, "Possible dependence");
});
