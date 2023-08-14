

import {groups,getMessagesTemplates} from "src/models/dummyData/dummydata";
import axios from 'axios';
import {getImageId} from 'src/models/dummyData/dummyimg';
import BoMOnlineAPI from "../BoMOnlineAPI";



export async function loadHomeFeed()
{
    let items = groups.map((group)=>loadGroupFeed(group)).flat();
    items = await addRandomData(items);
    return shuffle(items);
}



export async function loadRandomUsers() {
    let max = randomNumber(3,20);
    let users = await axios.get("https://randomuser.me/api/?inc=name,picture,login&nat=US&results="+max, { crossdomain: true });
    return users.data.results.map((user,i)=>{
        user.online = (randomNumber(0,10)>5) ? true : false;
        user.complete = randomNumber(0,100);
        return user;
    });
}


const randomNumber = (min,max) =>
{
    return Math.round(min + Math.random() * (max-min));
}

async function addRandomData(items) {

    let max = items.length;
    let imageIndex = fetchImageData(items);
    let texts = await axios.get("https://baconipsum.com/api/?type=meat-and-filler&paras="+max, { crossdomain: true });
    let users = await axios.get("https://randomuser.me/api/?inc=name,picture,login&nat=US&results="+max, { crossdomain: true });
    let imageData = await BoMOnlineAPI({imageInFeed:imageIndex.unique_ids});
    return items.map((item,i)=>{
        if(item.text) item.text = texts.data[i];
        if(item.data.image) item.data.image = imageData.imageInFeed[imageIndex.ids[i]]; 
        item.user = users.data.results[i];
        item.index_b = i;
        return item;
    });
}


function fetchImageData(items) {

    let ids = items.map((i)=> (i.data.image) ? getImageId(Math.random()).toString() : false);
    let unique_ids = ids.filter((i)=>(i!==false));
    for(let i in ids){ if(ids[i]) unique_ids.push(ids[i]) };
    return {ids,unique_ids};
}

function loadGroupFeed(group)
{
    let max = Math.round(Math.random()*20);
    let msgs = [];
    for (var i = 0; i <= max; i++) msgs.push({...shuffle(getMessagesTemplates())[0],...{group:group}});
    return msgs;
}


function shuffle(array) {
    var currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
  }
  