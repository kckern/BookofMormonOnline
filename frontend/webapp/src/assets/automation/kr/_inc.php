<?php

class SendbirdPlatform
{


    public static function call($uri,$payload,$method="POST")
    {
        $curl = curl_init();
        $appid = "386311f5-8923-4f4d-8be1-c3e95c2ad963"; //US1

        $token = "7ae679e631a6031ca4c70cf4b2aa23b9427280fd"; //US1

        curl_setopt_array($curl, [
        CURLOPT_URL => "https://api-$appid.sendbird.com/v3/${uri}",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => "",
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => "$method",
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            "Api-Token: $token",
            "Authorization: Basic Og==",
            "Content-Type: application/json"
        ],
        ]);
    
        $response = curl_exec($curl);
        $err = curl_error($curl);
    
        curl_close($curl);
    
        if ($err) {
        echo "cURL Error #:" . $err;
        } else {
          //  print_r(json_decode($response,1));
        return json_decode($response,1);
        }
    
    }

}