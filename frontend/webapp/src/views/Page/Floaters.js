
import typing from "src/views/_Common/Study/svg/typing.svg";

export function Floaters({ pageController }) {
  if (!pageController.appController.states.user.user) return null
  let list = pageController.states.studyBuddies;
  if (!list) return null;
  let users = Object.keys(list);
  let pageSlug = pageController.states.pageSlug;
  let me = pageController.appController.states.user.social?.user_id;
  let group = pageController.appController.states.studyGroup.activeGroup;
  return (
    <div>
      {users.map(u => {
        if (!group?.memberMap[u]) return null;
        let member = group?.memberMap[u];
        if (me === u) return null;
        if(member.metaData?.activeGroup!==group.url) return null;
        let topVal = document.querySelector(`div[textid=${pageSlug}\\/${list[u]}]`)?.offsetTop + "px";

        if (!topVal) topVal = "-50px";


      let activeGroupUrl = pageController.appController.states.studyGroup.activeGroup.url;
      let isTyping = pageController.appController.states.studyGroup?.typers?.[activeGroupUrl]?.includes(member.userId);
      let typingIndicator = (isTyping) ? <div className={"typing"}><img src={typing}/></div> : null;
      let summary = {};
      try { summary = JSON.parse(member?.metaData?.summary) } catch (e) { }
        return <div
          className={"userCircle online " + u}
          style={{
            position: "absolute",
            left: "0px",
            top: topVal,
            backgroundImage: `url('${member.plainProfileUrl}'),url(${member.plainProfileUrl})`

          }}
        >
          {typingIndicator}
          <div className="progressBadge">{summary?.completed || 0}%</div>
        </div>
      })}
    </div>
  );
}
