import { useEffect, useState } from 'react';
import ReactTooltip from 'react-tooltip';
//
import { assetUrl } from 'src/models/BoMOnlineAPI';
import BoMOnlineAPI from "src/models/BoMOnlineAPI"


function MapGroup({mapGroup, handleClickMapType})
{
    const {group,maps} = mapGroup;
    return <div className='map-group'>
        <h6>{group}</h6>
        <div className='map-group-list'>
        {maps.map((map,index)=><SingleMapMenuItem map={map} key={index} handleClickMapType={handleClickMapType} />)}
        </div>
    </div>
}
function SingleMapMenuItem({map,handleClickMapType})
{
    const {nextItemIsGroup} = map;
    if (map.zoom < 0) return null;
    const img = new Image();
    img.src = `${assetUrl}/map/preview/${map.slug}`;
    return <div
            data-tip={`<div class='mapType'><img src='${assetUrl}/map/preview/${map.slug}'><p>${map.desc}</p><div>`}
            data-for='mapselect'
            className={`map-type ${nextItemIsGroup ? "nextItemIsGroup" : ""}`}
            onClick={() => handleClickMapType(map.slug)}
        >
            {map.name}
        </div>
}

export default function MapTypes({ getMap, mapName, mapController }) {
    const [isShow, setIsShow] = useState(false),
        [mapList, setMapList] = useState(null),
        activeMap = mapList?.find(map => map.name === mapName);
        const activeMapGroup = activeMap?.group;

        const activeLabel = activeMap && activeMapGroup ? <div className="active-map-group">
                    <small
                    >{activeMapGroup}</small><span className="active-map-name">{activeMap.name}</span>
                </div> : activeMap ? <div className="active-map">{activeMap.name}</div> : null;

    useEffect(() => {
        getMapList()
    }, [])

    const getMapList = () => {
        BoMOnlineAPI({ maplist: true }).then((result) => {
            setMapList(result.maplist)
        })
    }

    const handleClickMapType = (mapSlug) => {
        setIsShow(false)
        getMap(mapSlug, null)
    }
    return (
        <div className='map-selector-menu noselect'>
            {!mapController.searching && <div className='searchBox'
            onClick={()=>mapController.setSearching(true)}
            >🔍</div>}
            {activeMap ? <div
                className={`map-type-active ${isShow ? "active" : ""}`}
                onClick={() => { ReactTooltip.hide();setIsShow(!isShow)}}
                data-tip={`<div class='mapType'><img src='${assetUrl}/map/preview/${activeMap?.slug}'><p>${activeMap?.desc}</p><div>`}
                data-for='activemapselect'
            >{activeLabel}
                <ReactTooltip
                    html={true}
                    id='activemapselect'
                    place='right'
                    effect='solid'
                    className='react-component-tooltip'
                />
            </div>
                : <></>}

            <div className='maptypes noselect' style={{ display: isShow ? "block" : "none" }}>
                {mapList?.filter(i=>{
                    return i.zoom >= 0 && mapName !== i.name
                })
                .reduce((acc, item, index, array) => {
                    // Check if the next item exists and if it is part of a group
                    const nextItemIsGroup = (index + 1 < array.length) && Boolean(array[index + 1].group);

                    if (item.group) {
                        let group = acc.find(i => i.isGroup && i.maps[0].group === item.group);
                        if (group) {
                            group.maps.push(item);
                            // Optionally, update the group's nextItemIsGroup if needed
                            // group.nextItemIsGroup = nextItemIsGroup;
                        } else {
                            acc.push({ isGroup: true, maps: [item], group: item.group, nextItemIsGroup });
                        }
                    } else {
                        acc.push({ ...item, nextItemIsGroup });
                    }
                    return acc;
                }, [])    
                
                .map((item, index) => {
                    if(item.isGroup) return <MapGroup mapGroup={item} key={index} handleClickMapType={handleClickMapType} />
                    else return <SingleMapMenuItem map={item} handleClickMapType={handleClickMapType} key={index} />
                })}
            </div>
            {mapList ? <ReactTooltip
                html={true}
                id='mapselect'
                place='right'
                effect='solid'
                className='react-component-tooltip'
            /> : <></>
            }
        </div>
    )
}
