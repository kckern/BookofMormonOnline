

import soundOn from "src/views/User/svg/sound-on.svg"
import soundOff from "src/views/User/svg/sound-off.svg"
import { isMobile, label } from "src/models/Utils";
import { usePageController } from "src/contexts/PageControllerContext";

export function MuteButton()
{
    const pageController = usePageController();
    if(!isMobile()) return null;
    if(!pageController?.states.activeRow) return null;
    const toggleSound = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const prefs = pageController.appController.states?.preferences || {};
        pageController.appController.functions.updatePrefs({ ...prefs, audio: !prefs.audio });
      }

    const audioOn = pageController.appController.states?.preferences.audio;
    const muteLabel = audioOn ? (label("audio_on") || "Audio on") : (label("audio_off") || "Audio off");
    return <div className="muteButton">
         <img onClick={toggleSound} role="button" tabIndex={0}
         onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){toggleSound(e);}}}
         aria-label={muteLabel} alt={muteLabel}
         src={audioOn ? soundOn : soundOff} />

    </div>
}