
import "./Names.css";

function Container({appController}) {

    const items = {...appController?.preLoad?.personList, ...appController?.preLoad?.placeList};
    console.log(appController?.preLoad)
    const names = Object.keys(items || {}).map(key => items[key].name.replace(/\d+/,"")).filter(i=>{
        if(/\s+/.test(i)) return false;
        return true;
    }).reduce((acc, cur) => {
        if(acc.indexOf(cur) === -1) acc.push(cur);
        return acc;
    },[]).sort();

    return <div className="container">
            <h3 className="title lg-4 text-center">Book of Mormon Names</h3>
            <div className="nameAnalysisList">
                {names.map((name, i) => (
                    <div key={i} className="nameAnalysisItem">{name}</div>
                ))}
            </div>
            {!names.length && <pre>
                {JSON.stringify(appController.preLoad, null, 2)}
            </pre>
            } 
        </div>
}   



export default Container;