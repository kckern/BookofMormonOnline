import moment from "moment";
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
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
  Alert,
  TabPane,
} from "reactstrap";
import { label } from "src/models/Utils";
import calendar_icon from "./svg/calendar.svg";
import momentDurationFormatSetup from "moment-duration-format";
import { history } from "src/models/routeHistory";
import Loader from "../_Common/Loader";
momentDurationFormatSetup(moment);
moment.locale(label("moment_locale"));

export function HistoryList({ studyLog, progressList, setHistoryView }) {
  useEffect(() => history.push("/user/history"), []);

  if (!studyLog) return   <Card>
    <CardHeader>
      <h5 className="title">
        <img src={calendar_icon} /> {label("study_history")}{" "}
        <span className="closeme" onClick={() => setHistoryView(false)}>
          ×
        </span>
      </h5>
    </CardHeader>

    <CardBody className={"studyList"}>
      <Alert color={"info"}>{label("login_for_history")}</Alert>
    </CardBody>
  </Card>

  const progressDictionary = !progressList
    ? null
    : progressList.progress.reduce(function (result, field, index) {
      result[progressList.dates[index]] = field;
      return result;
    }, {});

  const array_sum = (previousValue, currentValue) =>
    previousValue + currentValue;
  const sumDuration = (items) => {
    if (!Array.isArray(items)) {
      let keys = Object.keys(items);
      return keys.map((key) => sumDuration(items[key])).reduce(array_sum);
    }
    return items.map((item) => parseInt(item.duration) || 0).reduce(array_sum);
  };
  const countSessions = (items) => {
    if (!Array.isArray(items)) {
      let keys = Object.keys(items);
      return keys.map((key) => countSessions(items[key])).reduce(array_sum);
    }
    return items.length;
  };
  let calendar = {};

  for (let i in studyLog) {
    let item = studyLog[i];
    let year = new Date(item.timestamp * 1000).getFullYear().toString();
    let month = (new Date(item.timestamp * 1000).getMonth() + 1).toString();
    let day = (new Date(item.timestamp * 1000).getDate() + 1).toString();
    if (!calendar[year]) calendar[year] = {};
    if (!calendar[year][month]) calendar[year][month] = {};
    if (!calendar[year][month][day]) calendar[year][month][day] = [];
    calendar[year][month][day].push(item);
  }
  let yearList = Object.keys(calendar).reverse();
  let totalDuration = sumDuration(calendar);

  let totalHoursFloat = Math.round(
    moment.duration({ seconds: totalDuration }).asHours()
  );

  return (
    <Card>
      <CardHeader>
        <h5 className="title">
          <img src={calendar_icon} /> {label("study_history")}{" "}
          <span className="closeme" onClick={() => setHistoryView(false)}>
            ×
          </span>
        </h5>
      </CardHeader>

      <CardBody className={"studyList"}>
        {yearList.map((yearNum, i) => {
          let year = calendar[yearNum];
          let yearMonths = Object.keys(year).reverse();
          let yearDuration = sumDuration(year);
          let yearSessionCount = countSessions(year);
          let yearMonthCount = yearMonths.length;
          return (
            <div className="studyYear">
              {i > 0 ? (
                <h2>
                  {yearNum}{" "}
                  <span>
                    (
                    {moment
                      .duration(yearDuration, "seconds")
                      .format(label("duration_format"))}
                    )
                  </span>
                </h2>
              ) : null}
              {yearMonths.map((monthNum) => {
                let month = calendar[yearNum][monthNum];
                let monthDuration = sumDuration(month);
                let monthSessionCount = countSessions(month);
                let days = Object.keys(month).reverse();
                let monthDayCount = days.length;
                return (
                  <div className="studyMonth">
                    <h2>
                      <img src={calendar_icon} />{" "}
                      {moment([yearNum, monthNum - 1])
                        .locale(label("moment_locale"))
                        .format(label("history_date_format_month"))}{" "}
                      <span>
                        (
                        {moment
                          .duration(monthDuration, "seconds")
                          .format(label("duration_format"))}
                        )
                      </span>{" "}
                    </h2>
                    {days.map((date) => {
                      let day = month[date];
                      let dayDuration = sumDuration(day);
                        let dateField = moment([
                        yearNum,
                        monthNum - 1,
                        date - 1,
                      ]).format(label("day_month"));
                      let dateKey = moment([
                        yearNum,
                        monthNum - 1,
                        date - 1,
                      ]).format(label("intl_date"));
                      return day.map((session, i) => {
                        return (
                          <div className="studySession">
                            <div className={"progressField"}>
                              {i === 0 && progressDictionary?.[dateKey] ? (
                                <span>
                                  {parseFloat(
                                    progressDictionary[dateKey]
                                  ).toFixed(1)}
                                  %
                                </span>
                              ) : null}
                            </div>
                            <div className={"dateField"}>
                              {i === 0 ? dateField : null}
                            </div>
                            <div className={"timeField"}>
                              {moment(session.timestamp * 1000).format(
                                label("time_format")
                              )}
                            </div>
                            <div className={"descField"}>
                              <Link to={session.slug}>
                                {session.description ||
                                  label("extracurricular_activities")}
                              </Link>
                            </div>
                            <div className={"durationField"}>
                              {moment
                                .duration(session.duration, "seconds")
                                .format(label("duration_format"))
                                .replace(/^0 mins/, "1 min")
                                .replace(/^0분/, "1분")}
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
