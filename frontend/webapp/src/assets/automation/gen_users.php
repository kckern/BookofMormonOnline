<?php
require_once("_inc.php");


$users = json_decode(file_get_contents("https://randomuser.me/api/?inc=name%2Clogin%2Cgender&nat=US&results=10"));

foreach($users->results as $user)
{
        $user_id = $user->login->username;
        $payload = [
            "bot_userid"=>$user->login->username,
            "bot_nickname"=>$user->name->first . " " . $user->name->last,
            "bot_profile_url"=>"https://avatars.dicebear.com/api/".$user->gender."/".$user->login->uuid.".svg",
            "bot_type"=>"test_user",
            "bot_callback_url"=>"https://localhost",
            "is_privacy_mode"=>true
        ];

        $bot = SendbirdPlatform::call("bots",$payload);
        $id = $bot["bot"]["bot_userid"];


        $payload = [ "metadata"=>[
            "completed"=> (string)rand(0,90),
            "started"=> (string)rand(0,10),
            "time"=> rand(0,24) . " hours " . rand(0,59) . " mins"]            
        ];
        $metadata = SendbirdPlatform::call("users/$id/metadata",$payload);

        $url = "a8d5d36bb1b8d4afb382bb60f17bd588";
        SendbirdPlatform::call("group_channels/$url/invite",["user_ids"=>[$user_id]],"POST");   
        SendbirdPlatform::call("group_channels/$url/accept",["user_id"=>$user_id],"PUT");        
}