



export const groups = [
        {name:"Solo Study",type:"solo",members:1,notice:4},
        {name:"Jones Family",type:"private",members:0,notice:4},
        {name:"3rd Ward Sunday School",type:"private",members:0,notice:4},
        {name:"Maxwell Institute Book Club",type:"public",members:0,notice:4},
        {name:"BYU Student Association",type:"public",members:0,notice:4},
        {name:"Perfect Day Group",type:"public",members:0,notice:4},
        {name:"The Cultural Hall",type:"open",members:0,notice:4},
        {name:"Brooklyn YMCA",type:"open",members:0,notice:4},
        {name:"UVU Institute",type:"open",members:0,notice:4}
    ];



export const getMessagesTemplates = ()=>[
    {action:"commented on a passage",text:true,icon:"comment",data:{slug:null}},
    {action:"commented on a section",text:true,icon:"comment",data:{slug:null}},
    {action:"commented on an image",text:true,icon:"comment",data:{image:true}},

    {action:"highlighted a passage",text:false,icon:"highlight",data:{slug:null}},
    {action:"highlighted an image",text:false,icon:"highlight",data:{image:true}},


    {action:"completed a page",text:false,icon:null,data:{slug:null}},
    {action:"replied to a comment",text:true,icon:"comment",data:{slug:null}}
];