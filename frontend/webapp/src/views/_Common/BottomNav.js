import chat from './svg/chat.svg'
import { isMessengerNavigationEnabled } from '../../models/featureFlags'
import { resolveBottomSelection } from './bottomNavSelection'
import group_icon from './svg/group_icon.svg'
import { label } from 'src/models/Utils'
import { useRouteMatch, Link } from 'react-router-dom'
import React, { useState, useEffect } from 'react'
import HomeIcon from './Icons/HomeIcon'
import UserIcon from './Icons/UserIcon'
import MenuIcon from './Icons/MenuIcon'
import StudyIcon from './Icons/StudyIcon'
import { useAppController } from "src/contexts/AppControllerContext";

// Feature flag - messaging disabled until Phase 5 data migration
const USE_MESSENGER = isMessengerNavigationEnabled();

export function BottomMenu() {
  const appController = useAppController();
  const match = useRouteMatch()

  const determineSelection = () =>
    resolveBottomSelection(window.location.pathname, USE_MESSENGER)

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

  const allNavItems = [
    {
      title: label('groups') || 'Groups',
      icon: (
          <img
            className={activeGroup?.coverUrl ? 'activeGroup' : 'none'}
            src={activeGroupIcon || group_icon} 
            alt='chat'
          />
      ),
      activeIcon: <img src={activeGroupIcon || chat} alt='chat' />,
      path: '/groups',
      requiresMessenger: true,
    },
    {
      title: label('menu_home') || 'Home',
      icon: <HomeIcon className="img" fill="#7F7F7F" />,
      activeIcon: <HomeIcon className="img" />,
      path: '/home',
      requiresMessenger: true,
    },
    {
      title: label('menu_study') || 'Study',
      icon: <StudyIcon className='img' fill='#7F7F7F' />,
      activeIcon: <StudyIcon className='img' />,
      path: '/study',
      requiresMessenger: false,
    },
    {
      title: label('user') || 'User',
      icon: <UserIcon className='img' fill='#7F7F7F' />,
      activeIcon: <UserIcon className='img' />,
      path: '/home/user',
      requiresMessenger: false,
    },
    {
      title: label('menu_more') || 'More',
      icon: <MenuIcon fill='#7F7F7F' className='img' />,
      activeIcon: <MenuIcon className='img'  />,
      path: '/mobilemenu',
      requiresMessenger: false,
    },
  ]

  // Filter out messenger items when disabled
  const bottomNavItemsData = USE_MESSENGER 
    ? allNavItems 
    : allNavItems.filter(item => !item.requiresMessenger);

  return (
    <div
    className='bottom-nav'
    >
      {bottomNavItemsData.map((navItem, i) => {
        return (
          <Link key={navItem.path} to={navItem.path}>
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
