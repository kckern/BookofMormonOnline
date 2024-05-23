import { useEffect, useRef } from 'react';
import { detectScriptures } from "scripture-guide";
import { Collapse } from 'bootstrap';

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


export function getHtmlScriptureLinkParserOptions(clickHandler, additionalAttribs = {}) {
    return {
        replace: (domNode) => {
          let {attribs} = domNode;
            if (attribs?.classname === 'scripture_link') {
                const ref = domNode.children[0].data;
                attribs.class = attribs.classname;
                delete attribs.classname;
                attribs = {...attribs, ...additionalAttribs};
                return <a {...attribs} onClick={()=>clickHandler(ref)}>{ref}</a>;
            }
        }
    }
};

export function getDetectedScripturesHtml(html) {
    return detectScriptures(html, (scripture) => {
        if (!scripture) return;
        return `<a className="scripture_link">${scripture}</a>`
    });
}
