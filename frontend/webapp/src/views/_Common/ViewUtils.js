import { useEffect, useRef } from 'react';
import { detectScriptures } from "scripture-guide";
import { Collapse } from 'bootstrap';
import { determineLanguage } from '../../models/Utils';
import { makeScriptureLinkReplacer } from "./scriptureLinkReplacer";

// a react hook for detecting if a component is mounted
export function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted?.current; // returning the ref, so we can access its current value
}

// a react hook for self clearing timeouts when component unmounts
export function useTimeouts() {
  const timeouts = useRef({});

  const set = (key, callback, delay) => {
    if (timeouts.current[key]) {
      clearTimeout(timeouts.current[key]);
    }
    timeouts.current[key] = setTimeout(callback, delay);
  };

  const get = (key) => {
    return timeouts.current[key];
  }

  const getAll = () => {
    return timeouts.current;
  }

  const clear = (key) => {
    if (timeouts.current[key]) {
      clearTimeout(timeouts.current[key]);
      delete timeouts.current[key];
    }
  };

  const clearAll = () => {
    Object.values(timeouts.current).forEach(clearTimeout);
    timeouts.current = {};
  };

  useEffect(() => {
    return clearAll; // clear all on unmount
  }, []);

  return { set, get, getAll, clear, clearAll };
}


// Was a broken duplicate — the `attribs.classname` (lowercase) check never
// matched (html-react-parser preserves the emitted `className` casing), so
// scripture links in Map/Drawer/Commentary were silently non-clickable. Now
// keyed on `className` via the shared replacer. The old `additionalAttribs`
// param was dead (no caller ever passed it) and is dropped.
export function getHtmlScriptureLinkParserOptions(clickHandler) {
    return {
        replace: makeScriptureLinkReplacer({ onClick: clickHandler }),
    };
}

export function getDetectedScripturesHtml(html) {
    return detectScriptures(html, (scripture) => {
        if (!scripture) return;
        return `<a className="scripture_link">${scripture}</a>`
    }, determineLanguage());
}
