import { desiredBuildersFor } from "./ConstructionSystem.js";

const distanceBetween = (a = {}, b = {}) => Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));

export function scoreProjectForBuilder(builder = {}, project = {}, { relationship = 0 } = {}) {
  const desired = Math.max(1, Number(project.desiredBuilders) || desiredBuildersFor(project.type, project.spec));
  const assigned = Math.max(0, Number(project.assignedBuilders) || 0);
  if (assigned >= desired || project.progress >= 1 || project.alive === false || project.construction?.state === "cancelled") return -Infinity;
  const staffingNeed = (desired - assigned) / desired;
  const directorPriority = Math.max(0, Math.min(100, Number(project.priority) || Number(project.construction?.priority) || 50));
  const nearCompletion = Math.max(0, Number(project.progress) || 0);
  return 30 + directorPriority * 0.28 + staffingNeed * 30 + nearCompletion * nearCompletion * 30
    - distanceBetween(builder, project) * 0.12 + Math.max(-10, Math.min(10, Number(relationship) || 0)) * 0.15;
}

export function chooseBuilderAssignment({ builder = {}, projects = [], independentScore = 58, relationshipFor = () => 0, constructionFirst = false } = {}) {
  const ranked = projects.map(project => ({
    project,
    score: scoreProjectForBuilder(builder, project, { relationship: relationshipFor(project) })
  })).filter(candidate => Number.isFinite(candidate.score)).sort((a, b) => b.score - a.score || String(a.project.id).localeCompare(String(b.project.id)));
  if (ranked[0] && (constructionFirst || ranked[0].score > independentScore)) return { action: "join", project: ranked[0].project, score: ranked[0].score, independentScore };
  return { action: "independent", project: null, score: independentScore, joinScore: ranked[0]?.score ?? -Infinity };
}
