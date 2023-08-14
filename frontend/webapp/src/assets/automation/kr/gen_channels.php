<?php
require_once("_inc.php");
error_reporting(E_ERROR);

$userData = SendbirdPlatform::call("users",null,"GET");
foreach($userData['users'] as $item)
{
    if($item['user_id']=="kckern") continue;
    $users[] = $item['user_id'];
}

$groups = [
    ["name"=>"후기성도 연구회","type"=>"open"],
    ["name"=>"몰몬경 독서회","type"=>"public"],
    ["name"=>"대구 선교부","type"=>"public"]
];
$users = [];
foreach($groups as $group)
{
   /// shuffle($users);
    $members = [];//array_slice($users,0,rand(2,15));
   // $members[] = "kckern";

    //if($group['type']=="solo") $members = ["kckern"];
    $url = md5(uniqid());
    $payload = [
        "user_ids"=>$members,
        "name"=>$group['name'],
        "custom_type"=>$group['type'],
        "is_public"=>(($group['type']=="open") ? true : false),
        "cover_url"=>"https://avatars.dicebear.com/api/identicon/".md5(uniqid()).".svg",
        "channel_url"=>$url
    ];
        
    print_r($payload);


    SendbirdPlatform::call("group_channels",$payload,"POST");

    if($group['type']!="open")
    foreach($members as $member)
    {
        $payload = [
            "user_id"=>$member
        ];
      //  SendbirdPlatform::call("group_channels/$url/accept",$payload,"PUT");
    }


}