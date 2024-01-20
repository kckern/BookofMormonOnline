import chat from './svg/chat.svg'
import group_icon from './svg/group_icon.svg'
import { label } from 'src/models/Utils'
import { useRouteMatch, Link } from 'react-router-dom'
import React, { useState, useEffect } from 'react'
import HomeIcon from './Icons/HomeIcon'
import UserIcon from './Icons/UserIcon'
import MenuIcon from './Icons/MenuIcon'
import StudyIcon from './Icons/StudyIcon'

export function BottomMenu({ appController }) {
  const match = useRouteMatch()

  const determineSelection = () => {
    let slugRoot = window.location.pathname.split('/')[1]
    if (['groups', 'group', 'invite'].includes(slugRoot)) return 0
    if (['community'].includes(slugRoot)) return 1
    if (['user'].includes(slugRoot)) return 3
    if (['mobilemenu'].includes(slugRoot)) return 4
    return 2
  }

  const [activeSelection, setActiveSelection] = useState(determineSelection)

  useEffect(() => {
    let val = determineSelection()
    setActiveSelection(val)
    document
      .querySelector(`.bottom-nav-item.active`)
      ?.classList.remove('active')
    document.getElementById(`nav-item-${val}`)?.classList.add('active')
  }, [window.location.pathname, match.params])
  
  const activeGroup =
    appController.states.studyGroup.studyModeOn &&
    appController.states.studyGroup?.activeGroup
  const activeGroupIcon = activeGroup?.coverUrl || null

  let count = 0
  for (let i in appController.states.studyGroup.groupList) {
    let group = appController.states.studyGroup.groupList[i]
    if (!group) continue
    count = count + group.unreadMessageCount
  }

  let counter =
    count > 0 && appController.states.studyGroup.studyModeOn ? (
      <div className='totalUnreadCount'>{count}</div>
    ) : null

  const bottomNavItemsData = [
    {
      title: label('groups'),
      icon: (
          <img
            className={activeGroup?.coverUrl ? 'activeGroup' : 'none'}
            src={activeGroupIcon || group_icon} 
            alt='chat'
          />
      ),
      activeIcon: <img src={activeGroupIcon || chat} alt='chat' />,
      path: '/groups',
    },
    {
      title: label('menu_home'),
      icon: <HomeIcon className="img" fill="#7F7F7F" />,
      activeIcon: <HomeIcon className="img" />,
      path: '/community',
    },
    {
      title: label('menu_study'),
      icon: <StudyIcon className='img' fill='#7F7F7F' />,
      activeIcon: <StudyIcon className='img' />,
      path: '/study',
    },
    {
      title: label('user'),
      icon: <UserIcon className='img' fill='#7F7F7F' />,
      activeIcon: <UserIcon className='img' />,
      path: '/user',
    },
    {
      title: label('menu_more'),
      icon: <MenuIcon fill='#7F7F7F' className='img' />,
      activeIcon: <MenuIcon className='img'  />,
      path: '/mobilemenu',
    },
  ]

  return (
    <div
    className='bottom-nav'
    >
      {bottomNavItemsData.map((navItem, i) => {
        return (
          <Link key={navItem.title} to={navItem.path}>
            <div
            id={`nav-item-${i}`}
            className={`bottom-nav-item`}
            >
              {navItem.path === '/groups' && <>{counter}</>}
              {activeSelection === i ? <>{navItem.activeIcon}</> :<>{navItem.icon}</> }
              <p>{navItem.title}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
