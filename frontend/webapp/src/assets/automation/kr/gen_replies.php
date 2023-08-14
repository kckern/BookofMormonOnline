<?php
require_once("_inc.php");
$users = SendbirdPlatform::call("group_channels/$group/members",null,"GET");

$users = $users['members'];


$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => "http://hangul.thefron.me/api/generator",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "POST",
  CURLOPT_POSTFIELDS => "paragraphs=15&length=long",
]);
$response = json_decode(curl_exec($curl));
$err = curl_error($curl);
curl_close($curl);
$fake_text = explode("\n\n",$response->ipsum);


$recent_posts = SendbirdPlatform::call("group_channels/$group/messages?reverse=true&limit=10&message_ts=".time()."000",null,"GET");




$latest = $recent_posts['messages'];


foreach($latest as $parentMessage)
{
    $parentMessageId = $parentMessage['message_id'];


    foreach($fake_text as $text_value)
    {
        if(rand(0,10)>4) continue;

        $sents = explode(".",$text_value);
        $tmp = array_slice($sents,0,rand(1,count($sents)));
        $text_value=implode(".",$tmp).".";




        $theadMessages = SendbirdPlatform::call("group_channels/$group/messages?parent_message_id=$parentMessageId&include_replies=true&message_ts=".time()."000",null,"GET");


        shuffle($theadMessages['messages']);
        
        foreach($theadMessages['messages'] as $item)
        {
            shuffle($users);
            $user_id = $users[0]['user_id'];

            $message_id = $item['message_id'];
            if(rand(0,10)>7) continue;
            $payload = [
                "reaction"=>"like",
                "user_id"=>"$user_id"
            ];

            $r = SendbirdPlatform::call("group_channels/$group/messages/${message_id}/reactions",$payload,"POST");
            echo "LIKE ".$r['msg_id']." - (".$r['user_id'].")\n";
        }

        shuffle($users);
        $user_id = $users[0]['user_id'];

        $payload = [
            "message"=>"$text_value",
            "user_id"=>"$user_id",
            "parent_message_id"=>"$parentMessageId",
            "message_type" =>"MESG"
        ];

        $r = SendbirdPlatform::call("group_channels/$group/messages",$payload,"POST");

        echo "REPLY ".$r['user']['user_id'].": ".$r['message']."\n";
    }
    exit;
}

