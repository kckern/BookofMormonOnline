
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useState } from 'react';
import { generateFakeProgressData } from "src/models/Utils"
import "./StudyGroupProgress.css"

export default function StudyGroupProgress({ appController }) {

	const [groupProgressData, setData] = useState(null);
	const [highlightedUserId, highlightUserId] = useState(null);
	const [highlightedTime, highlightTime] = useState(null);
	const userIds = appController.states.studyGroup.activeGroup.members.map(u => u.userId);
	const memberMap = appController.states.studyGroup.activeGroup.memberMap;
	if (!groupProgressData) {

		generateFakeProgressData(userIds).then(data => setData(data));
		return (
			<div className={"StudyGroupChatPanel "} >

				Loading....
			</div>
		);

	}
	const mouseOverPoint = (e) => {

		let userId = e.target.series.name;
		let time = e.target.x;
		//let progress = e.target.y;
		highlightUserId(userId);
		highlightTime(time);

	}
	const mouseOverSeries = (e) => {

		let userId = e.target.name;
		highlightUserId(userId);

	}
	const options = {
		chart: {
			width: 700,
			backgroundColor: "#EEE",
			marginTop: "40",
			marginRight: "60",
			style: { fontFamily: "'Roboto Condensed', 'Arial Narrow', sans-serif" },
			events:
			{
				load: (e) => {

					let chart = e.target;
					chart.series.map(series => {
						var l = series.points.length;
						var p = series.points[l - 1];
						p.update({
							marker: {
								enabled: true,
								//symbol: "plus",
								symbol: 'url(' + memberMap[series?.name]?.profileUrl + ')',
								height: 10,
								width: 10,
								lineColor: "red"
							}
						});
					});
				}
			}
		},
		credits: {
			enabled: false
		},
		title: {
			text: null
		},
		legend: {
			enabled: false
		},
		yAxis: {
			tickInterval: 10,
			labels: {
				formatter: function () {
					return this.value + "%";
				}
			},
			title: {
				text: null
			},
			max: 100,
			gridLineWidth: 1
		}, xAxis: {
			type: "datetime",
			labels: {
				formatter: function () {
					return Highcharts.dateFormat('%b %e', this.value);
				}
			}
		},
		plotOptions: {
		},
		series: groupProgressData.map(userData => {
			return {
				type: "spline",
				marker: { enabled: false, symbol: "circle" },
				events: {
					click: mouseOverSeries
				},
				name: memberMap[userData.user_id]?.userId,
				nickname: memberMap[userData.user_id]?.nickname,
				data: userData.progress,

				tooltip: {
					headerFormat: '',
					userHTML: true,
					pointFormatter: function(){
						let nickname = memberMap[this.series.name]?.nickname;
						return `<div><b>${nickname}</b><br/>${new Date(this.x).toISOString().slice(0,10)}: <b>${this.y}%</b><div>`;
					} 
				}
			}
		})


	}


	let userData = memberMap[highlightedUserId];



	return (
		<div className={"StudyGroupChatPanel progress"} >

			<HighchartsReact
				highcharts={Highcharts}
				options={options}
			/>
			<div className={"details"}>
				<h3>Details</h3>


				<div
					className={"userCircle online"}
					style={{ backgroundImage: `url(${userData?.profileUrl})` }}
				>
					<div className={"progressBadge"}>{userData?.metaData?.completed}%</div>
				</div>
				{userData?.nickname}
				{userData?.userId}

			</div>
		</div>
	);

}