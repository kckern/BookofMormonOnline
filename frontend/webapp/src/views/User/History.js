
import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Col,
  Row,
  NavItem,
  NavLink,
  Nav,
  TabContent,
  TabPane,
} from "reactstrap";

import ReactTooltip from "react-tooltip";
import CalendarHeatmap from 'react-calendar-heatmap';
import { label, getDaysArray } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import calendar from "./svg/calendar.svg";
import growth from "./svg/growth.svg";

export function StudyHistory({ setHistoryView, appController, setStudyLog, setStudySummary, studyLog, setProgressList, progressList }) {
  const [horizontalTabs, setHorizontalTabs] = useState(new Date().getFullYear().toString());
  let tokenToLoad = appController.states.user.token;
  const [years, setYears] = useState(null);
  const [maxValue, setMaxValue] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
  useEffect(() => {
    BoMOnlineAPI({ studylog: [tokenToLoad] }, { useCache: false }).then(result => {
      if (result?.studylog) {
        setHistoryView(false);
        setStudyLog(result.studylog[tokenToLoad]?.sessions);
        setStudySummary(result.studylog[tokenToLoad]?.summary);
        BoMOnlineAPI({ userdailyscores: [tokenToLoad] }, { useCache: false }).then(result => {
          if (result?.userdailyscores) {
            const progressData = result.userdailyscores[tokenToLoad];
            setProgressList(progressData);
            const seriesData = prepareSeriesData(progressData);
            setSeriesData(seriesData);
            const mostRecent = seriesData?.[0]?.data?.map(i => i[1]).reverse()[0];
            //console.log({seriesData,mostRecent})
            setMaxValue(mostRecent || null);
          }
        });
      }
    });
  }, [appController.states.user?.user])

  if (studyLog && !years) {
    let yearList = [];
    for (let i in studyLog) {
      let item = studyLog[i];
      let year = new Date(item.timestamp * 1000).getFullYear().toString();
      if (yearList.includes(year)) continue;
      yearList.push(year);
    }
    yearList.sort();
    setYears(yearList);
    setHorizontalTabs(yearList[yearList.length - 1]);
  }

  let monthLabels = label("short_month_labels")?.split(",") || [];
  if (monthLabels.length < 12) monthLabels = Array.from(Array(13).keys()).slice(1);
  if (!studyLog) return null;

  return <Card className="historySide" onClick={() => setHistoryView(true)}>
    <CardHeader>
      <h5 className="title"><img src={calendar} /> {label("study_history")}</h5>
    </CardHeader>

    <CardBody>
      <div className="nav-tabs-navigation">
        <div className="nav-tabs-wrapper">
          <Nav id="tabs" role="tablist" tabs>
            {(years || [(new Date()).getFullYear().toString()]).map((y,i) => <NavItem key={i}>
              <NavLink
                aria-expanded={horizontalTabs === y}
                data-toggle="tab"
                key={y}
                href={null}
                role="tab"
                className={horizontalTabs === y ? "yeartab active" : "yeartab"}
                onClick={() => setHorizontalTabs(y)}
              >
                {y}
              </NavLink>
            </NavItem>)}
          </Nav>
        </div>
      </div>

      <ReactTooltip effect="solid" id="calendarToolTip" type="dark" offset={{'top': -8}} />
      <TabContent
        className="text-center"
        id="my-tab-content"
        activeTab={horizontalTabs}
      >
        {(years || [(new Date()).getFullYear().toString()]).map((y,k) => {

          const getDecile = (value, sample) => {
            if (!value) return null;
            let index = 1 + sample.indexOf(value);
            let perc = index * 10 / (sample.length);
            return Math.round(perc);
          }

          let dictionary = {};
          let contentIndex = {};
          for (let i in studyLog) {
            let item = studyLog[i];
            let year = new Date(item.timestamp * 1000).getFullYear().toString();
            if (year !== y) continue;
            let date = new Date(item.timestamp * 1000).toISOString().substring(0, 10);
            let duration = item.duration;
            if (!dictionary[date]) dictionary[date] = 0;
            if (!contentIndex[date]) contentIndex[date] = []
            dictionary[date] += duration;
            contentIndex[date].push(item.description);
          }

          let values = Object.values(dictionary).sort(function (a, b) {
            return a - b;
          });

          let yearDates = getDaysArray(new Date(y + "-01-01"), new Date(y + "-12-31")).map(d => d.toISOString().substring(0, 10));


          let hVals = [[], []];
          for (let i in yearDates) {
            let date = yearDates[i];
            let month = parseInt(date.substr(5, 2));
            let h = (month < 7) ? 0 : 1;
            let dayDuration = dictionary[date] || null;
            hVals[h].push({
              date: date,
              duration: dayDuration || 0,
              description: contentIndex[date]?.[0] || null,
              count: getDecile(dayDuration, values) || null
            })
          }
          const customTooltipDataAttrs = function (value) {
            return { 'data-html': true, 'data-for': "calendarToolTip", 'data-tip': formatToolTip(value) }
          };

          const formatToolTip = (value) => {
            let seconds = value.duration;
            let time = Math.round(seconds / 60) + " " + label("mins");
            let desc = value.description;
            let date = new Date(value.date).toLocaleDateString("en-US", { dateStyle: "full" });

            if (!value.count) return date;

            return `${date}<br/>${desc}<br/>${time}`;
          }

          return <TabPane key={k} tabId={y} role="tabpanel">{
            [
              { range: ['-01-01', '-06-30'], vals: hVals[0] },
              { range: ['-07-01', '-12-31'], vals: hVals[1] }
            ].map((i,j) => <CalendarHeatmap
              key={j}
              onClick={() => setHistoryView(y)}
              tooltipDataAttrs={customTooltipDataAttrs.bind(this)}
              startDate={new Date(y + i.range[0])}
              endDate={new Date(y + i.range[1])}
              monthLabels={monthLabels}
              showMonthLabels={true}
              showWeekdayLabels={false}
              gutterSize={1}
              showOutOfRangeDays={true}
              classForValue={(value) => {
                if (!value) {
                  return 'color-empty';
                }
                return `color-scale-${value.count}`;
              }}
              values={i.vals}
            />)
          }
          </TabPane>
        }
        )}
      </TabContent>
    </CardBody>
    {(progressList && maxValue) ? (<><CardHeader>
      <h5 className="title"><img src={growth} /> {label("study_progress")}</h5>
    </CardHeader>
      <CardBody>
        <HighchartsReact
          highcharts={Highcharts}
          options={{
            chart: {
              renderTo: 'container',
              width: 300,
              height: 300,
              backgroundColor: "#FFF",
              marginTop: "20",
              paddingTop: "20",
              style: { fontFamily: "'Roboto Condensed', 'Arial Narrow', sans-serif", },
              events:
              {
                load: (e) => {

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
              max: maxValue,
              gridLineWidth: 1
            },
            xAxis: {
              type: "datetime",
              tickPixelInterval: 60,
              labels: {
                formatter: function () {
                  return Highcharts.dateFormat(((progressList?.progress?.length > 100) ? '%b %Y' : '%d %b %Y'), this.value);
                }
              }
            },
            series: seriesData
          }}
        />
      </CardBody></>) : null}
  </Card>
}


function prepareSeriesData(progressList) {
  if (!progressList?.progress) return null;
  let chartdata = progressList.progress.map((val, i) => [(new Date(progressList.dates[i]) * 1), val]);
  let series_index = 0;
  let lastval = 0;
  let data = [[]];
  for (let i in chartdata) {
    let item = chartdata[i];
    let thisval = item[1];
    if (lastval > thisval) { series_index++; data[series_index] = []; }
    data[series_index].push(item);
    lastval = thisval;
  }

  return data.map(series => ({
    type: "spline",
    color: "#6bd098",
    lineWidth: 5,
    marker: { enabled: false, symbol: "circle" },
    events: {
      click: () => { }
    },
    name: "Progress",
    data: series,
    tooltip: {
      headerFormat: '',
      userHTML: true,
      pointFormatter: function () {
        return `<div>${new Date(this.x).toISOString().slice(0, 10)}: <b>${this.y}%</b><div>`;
      }
    }
  }))
}