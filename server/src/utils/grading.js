// Score limits and grading scale used for report cards.
const CA_MAX = 40;
const EXAM_MAX = 60;

const GRADE_SCALE = [
  { min: 70, grade: 'A', remark: 'Excellent' },
  { min: 60, grade: 'B', remark: 'Very Good' },
  { min: 50, grade: 'C', remark: 'Good' },
  { min: 45, grade: 'D', remark: 'Fair' },
  { min: 40, grade: 'E', remark: 'Pass' },
  { min: 0, grade: 'F', remark: 'Needs Improvement' },
];

function gradeFor(total) {
  return GRADE_SCALE.find((g) => total >= g.min);
}

const round2 = (n) => Math.round(n * 100) / 100;

// Returns the 1-based position of each id given { id: average }, with ties sharing a position.
function rankPositions(averages) {
  const sorted = Object.entries(averages).sort((a, b) => b[1] - a[1]);
  const positions = {};
  sorted.forEach(([id, avg], i) => {
    positions[id] = i > 0 && avg === sorted[i - 1][1] ? positions[sorted[i - 1][0]] : i + 1;
  });
  return positions;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

module.exports = { CA_MAX, EXAM_MAX, GRADE_SCALE, gradeFor, rankPositions, ordinal, round2 };
