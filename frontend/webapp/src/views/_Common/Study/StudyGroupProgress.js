import "./StudyGroupProgress.css";
import { useAppController } from "src/contexts/AppControllerContext";

/**
 * Per-member study progress panel.
 *
 * NOTE: there is no backend endpoint for per-member *historical* progress
 * (a time-series), so the previous Highcharts spline was populated entirely by
 * `generateFakeProgressData()` — fabricated random numbers. That has been
 * removed: this panel now shows only REAL data we actually have on the client,
 * namely each member's current completion percentage (from the member's
 * `metaData.summary.completed`, the same field the group bar / leaderboard use),
 * and is explicit that a progress-over-time chart is not yet available.
 *
 * When a real per-member progress-history endpoint exists, restore the chart
 * here and bind its series to that data.
 */

function parseSummary(member) {
	try {
		return JSON.parse(member?.metaData?.summary) || {};
	} catch (e) {
		return {};
	}
}

export default function StudyGroupProgress() {
	const appController = useAppController();
	const activeGroup = appController.states.studyGroup.activeGroup;
	const members = activeGroup?.members || [];
	const memberMap = activeGroup?.memberMap || {};

	const rows = members
		.map((member) => {
			const summary = parseSummary(member);
			const mapped = memberMap[member.userId] || {};
			return {
				userId: member.userId,
				nickname: member.nickname || mapped.nickname,
				profileUrl: member.profileUrl || mapped.profileUrl,
				completed: parseFloat(summary.completed) || 0,
			};
		})
		.filter((row) => !!row.userId)
		.sort((a, b) => b.completed - a.completed);

	return (
		<div className={"StudyGroupChatPanel progress"}>
			<div className={"progressNotice"}>
				Per-member progress history is not available yet. Showing current
				completion.
			</div>
			<div className={"progressList"}>
				{rows.map((row) => (
					<div className={"progressRow"} key={row.userId}>
						<div
							className={"userCircle"}
							style={{ backgroundImage: `url(${row.profileUrl})` }}
						/>
						<div className={"progressMeta"}>
							<div className={"nickname"}>{row.nickname}</div>
							<div className={"progressBar"}>
								<div
									className={"progressBarFill"}
									style={{ width: `${Math.min(100, row.completed)}%` }}
								/>
								<span className={"progressBadge"}>{row.completed}%</span>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
