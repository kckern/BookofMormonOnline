<?php
require_once("_inc.php");



$url = "99a56fe7e8640bd08fbb2b6711c35f34";
foreach(range(1,5) as $num)
{
        $user = json_decode(file_get_contents("https://api.namefake.com/korean-south-korea/random"));
        $user_id = $user->email_u;
        $payload = [
            "bot_userid"=>$user_id,
            "bot_nickname"=>$user->name,
            "bot_profile_url"=>"https://avatars.dicebear.com/api/bottts/".$user->uuid.".svg",
            "bot_type"=>"test_user",
            "bot_callback_url"=>"https://localhost",
            "is_privacy_mode"=>true
        ];
        $bot = SendbirdPlatform::call("bots",$payload);
        $id = $bot["bot"]["bot_userid"];


        $payload = [ "metadata"=>[
            "summary"=> json_encode(["completed"=>(string)rand(2,80)])]            
        ];
        $metadata = SendbirdPlatform::call("users/$id/metadata",$payload);

        SendbirdPlatform::call("group_channels/$url/invite",["user_ids"=>[$user_id]],"POST");   
        SendbirdPlatform::call("group_channels/$url/accept",["user_id"=>$user_id],"PUT");        
}