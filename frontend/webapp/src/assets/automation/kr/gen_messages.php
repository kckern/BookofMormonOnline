<?php

$num = 1;

if(!empty($argv[1])) $num = (int) $argv[1];


/*

SELECT id
FROM `bom_xtras_image` i
JOIN bom_text t
ON i.location_guid = t.guid
WHERE t.page = "4becc77f2d75f"


SELECT id
FROM `bom_xtras_commentary` c
JOIN bom_text t
ON c.location_guid = t.guid
WHERE t.page = "4becc77f2d75f"

SELECT slug
FROM `bom_section` s
JOIN `bom_slug` l
ON l.link = s.guid
WHERE s.`parent` = '4becc77f2d75f'
LIMIT 50


*/
require_once("_inc.php");
$group = "9e637305cb15bad3ad190d563219b67f"; 
$page = "lehites";
$img = [1026,1027,1028,1029,1030,1031,1032,1033,1034,1035,1036,1037,1038,1040,1041,1042,1043,1044,1045,1046,1047,1050,1051,1077,1082,1084,1085,1086,1088,1089,1090,1091,1135,1138,1139,1140,1141,1142,1147,1148,1249,1250,1251,1252,1253,1254,1255,1256,1257,1258,1259,1260,1261,1262,1263,1264,1265,1266,1267,1268,1269,1270,1271,1272,1273,1274,1276,1277,1278,1279,1280,1281,1282,1283,1284,1285,1286,1287,1288,1289,1290,1291,1292,1293,1294,1295,1296,1297,1298,1299,1300,1301,1302,1303,1304,1305,1306,1307,1308,1309,1310,1311,1312,1313,1314,1315,1316,1317,1318,1319,1320,1321,1322,1323,1324,1325,1326,1327,1328,1329,1330,1331,1332,1333,1334,1335,1336,1337,1338,2056,2060,2061,2066,2068,2072,2073,2074,2075,2076,2077,2078,2079,2080,2081,2082,2083,2084,2085,2086,2087,2088,2089,2090,2091,2092,2093,2094,2095,2096,2097,2098,2099,2100,2101,2102,2103,2104,2105,2106,2107,2108,2109,2110,2111,2112,2113,2114,2115,2116,2117,2118,2119,2121,2122,2123,2124,2125,2126,2127,2128,2129,2130,2131,2133,2134,2135,2136,2137,2138,2139,2140,2141,2143,2144,2145,2146,2147,2148,2187,2188,2189,2190,2191,2192,2193,2194,2195,2196,2197,2198,2199,2200,2201,2202,2203,2204,2205,2206,2207,2208,2209,2210,2211,2212,2213,2214,2215,2216,2217,2218,2219,2220,2221,2222,2223,2224,2225,2226,2227,2228,2229,2230,2231,2232,2233,2234,2235,2236,2237,2617,2618,2620,2621,2622,2623,2624,2625,2626,2627,2628,2629,2630,2631,2632,2633,2634,2635,2636,2637,2638,2639,2640,2641,2642,2643,2644,2645,2646,2647,2648,2649,2650,2651,2652,2653,2654,2655,2656,2657,2658,2659,2660,2661,2662,2663,2664,2665,2666,2667,2668,2669,2670,2671,2672,2673,2674,2675,2676,2677,2678,2679,2680,2681,2682,2683,2684,2685,2686,2687,2688,2689,2690,2691,2692,2693,2694,2695,2696,2697,2698,2699,2700,2701,2702,2703,2704];
$section = ["lehis-prophetic-call","escape-out-of-jerusalem","trip-back-to-jerusalem-to-retrieve-the-plates-of-brass","another-attempt-at-getting-the-brass-plates","a-final-attempt-at-getting-the-brass-plates","nephis-covert-operation","lehis-family-reunion","trip-back-to-jerusalem-to-retrieve-ishmaels-family","lehis-dream","nephis-response-and-understanding","departure-from-the-valley-of-lemuel","pass-through-shazer","troubles-in-nahom","arrival-in-bountiful","departure-towards-the-promised-land"];
$com = [1000001301,1000101301,1000301301,1001501301,1001901301,1002401301,1002501301,1003001301,1003901301,1005001301,1005801301,1008001301,1008401301,1010701301,1013801301,1014101301,1014201301,1015401301,1015501301,1018201301,1019901301,1020601301,1027501301,1029901301,1033601301,1034301301,1038301301,1039701301,1041301301,1041801301,1042901301,1043801301,1044001301,1047901301,1049801301,1051401301,1054801301,1058301301,1059001301,1061001301,1061201301,1063901301,1065101301,1065301301,1065701301,1066401302,1066401301,1067101301,1069101301,1069701301,1083401301,1083701301,1084501301,1084701301,1085501301,1085601301,1086101301,1086801301,1088401301,1091001301,1091101301];
$words = [];//["the","be","to","of","and","a","in","that","have","I","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no","just","him","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most","us"];
$text = range(1,70);
$fax = range(1,70);

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
  CURLOPT_POSTFIELDS => "paragraphs=20&length=long",
]);
$response = json_decode(curl_exec($curl));
$err = curl_error($curl);
curl_close($curl);
$fake_text = explode("\n\n",$response->ipsum);



$types = ["text","text","text","text","text","section","section","section","text","text","img","fax","fax","fax","fax","com","com","com","com","com","com","com"];
$types = ["com","text","com","section","com","text","com","section"];

$ttypes = ["text","com","section"];
foreach($fake_text as $text_value)
{
    //$sents = explode(".",$text_value);
    //$tmp = array_slice($sents,0,rand(1,count($sents)));
  //  $text_value=implode(".",$tmp).".";

    $val = [];
    shuffle($users);
    shuffle($types);
    shuffle($words);
    $user_id = $users[0]['user_id'];
    $type = $types[0];
    $array = (array) ${$type};
    shuffle($array);
    $value = $array[0];
    if($type=="fax") $value.=".1840";
    $val[$type] = $value;
    $encoded = json_encode(["links"=>$val]);


    if(in_array($type,$ttypes))
    {
        $highlights = array_slice($words,0,4);
        $description = " Event Description";
        $encoded = json_encode(["links"=>$val,"highlights"=>$highlights,"description"=>$description]);
    }

    $payload = [
        "message"=>"$text_value",
        "user_id"=>"$user_id",
        "custom_type"=>"$page",
        "data" =>($encoded)
    ];
    print_r($payload);
    SendbirdPlatform::call("group_channels/$group/messages",$payload);


    require_once("gen_replies.php");

    sleep(rand(1,6));
}