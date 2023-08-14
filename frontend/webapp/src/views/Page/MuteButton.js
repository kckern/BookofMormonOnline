

import soundOn from "src/views/User/svg/sound-on.svg"
import soundOff from "src/views/User/svg/sound-off.svg"
import { isMobile } from "src/models/Utils";

export function MuteButton({pageController})
{
    if(!isMobile()) return null;
    if(!pageController?.states.activeRow) return null;
    const toggleSound = (e) => {
        e.stopPropagation();
        e.preventDefault();
        let prefs = pageController.appController.states?.preferences;
        prefs.audio = !prefs.audio;
        pageController.appController.functions.updatePrefs(prefs);
      }

    return <div className="muteButton">
         <img onClick={toggleSound} 
         src={pageController.appController.states?.preferences.audio ? soundOn : soundOff} />
          
    </div>
}