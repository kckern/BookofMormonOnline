INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea200b','menu','menu_home','Home')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_home', label_text = 'Home';
        
DELETE FROM bom_translation WHERE guid='566e232ea200b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea200b','ko','label_text','홈','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea209f','menu','menu_contents','Contents')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_contents', label_text = 'Contents';
        
DELETE FROM bom_translation WHERE guid='566e232ea209f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea209f','ko','label_text','목차','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea219b','menu','menu_timeline','Timeline')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_timeline', label_text = 'Timeline';
        
DELETE FROM bom_translation WHERE guid='566e232ea219b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea219b','ko','label_text','연대표','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea2217','menu','menu_map','Map')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_map', label_text = 'Map';
        
DELETE FROM bom_translation WHERE guid='566e232ea2217' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea2217','ko','label_text','지도','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea2292','menu','menu_places','Places')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_places', label_text = 'Places';
        
DELETE FROM bom_translation WHERE guid='566e232ea2292' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea2292','ko','label_text','장소','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea2317','menu','menu_people','People')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_people', label_text = 'People';
        
DELETE FROM bom_translation WHERE guid='566e232ea2317' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea2317','ko','label_text','인물','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea2409','menu','menu_fax','Facsimiles')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_fax', label_text = 'Facsimiles';
        
DELETE FROM bom_translation WHERE guid='566e232ea2409' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea2409','ko','label_text','사본','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea248c','menu','menu_about','About')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_about', label_text = 'About';
        
DELETE FROM bom_translation WHERE guid='566e232ea248c' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea248c','ko','label_text','소개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea2505','menu','menu_contact','Contact')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_contact', label_text = 'Contact';
        
DELETE FROM bom_translation WHERE guid='566e232ea2505' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea2505','ko','label_text','연락','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea2580','menu','menu_search','Search')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_search', label_text = 'Search';
        
DELETE FROM bom_translation WHERE guid='566e232ea2580' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea2580','ko','label_text','검색','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea31b8','menu','home_title','Book of Mormon Online')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'home_title', label_text = 'Book of Mormon Online';
        
DELETE FROM bom_translation WHERE guid='566e232ea31b8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea31b8','ko','label_text','몰몬경·KR','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea31b6','menu','home_heading','A Book of Mormon Study Resource')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'home_heading', label_text = 'A Book of Mormon Study Resource';
        
DELETE FROM bom_translation WHERE guid='566e232ea31b6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea31b6','ko','label_text','몰몬경 학습 자원','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea31b7','menu','home_subtitle','A dynamic, social study resource for all students of the Book of Mormon')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'home_subtitle', label_text = 'A dynamic, social study resource for all students of the Book of Mormon';
        
DELETE FROM bom_translation WHERE guid='566e232ea31b7' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea31b7','ko','label_text','몰몬경 학습 자원','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea3433','progress','progress','Progress')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'progress', label_text = 'Progress';
        
DELETE FROM bom_translation WHERE guid='566e232ea3433' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea3433','ko','label_text','진도','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea35a4','user','username','Username')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'username', label_text = 'Username';
        
DELETE FROM bom_translation WHERE guid='566e232ea35a4' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea35a4','ko','label_text','아이디','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea3620','user','password','Password')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'password', label_text = 'Password';
        
DELETE FROM bom_translation WHERE guid='566e232ea3620' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea3620','ko','label_text','비밀번호','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea3796','user','sign_up','Sign Up')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'sign_up', label_text = 'Sign Up';
        
DELETE FROM bom_translation WHERE guid='566e232ea3796' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea3796','ko','label_text','회원 가입','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea3fd8','title','table_of_contents','Table of Contents')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'table_of_contents', label_text = 'Table of Contents';
        
DELETE FROM bom_translation WHERE guid='566e232ea3fd8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea3fd8','ko','label_text','목차','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea3fd9','title','timeline_event','Timeline event')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'timeline_event', label_text = 'Timeline event';
        
DELETE FROM bom_translation WHERE guid='566e232ea3fd9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea3fd9','ko','label_text','연대표의 사건','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea3fd0','title','timeline_title','Timeline')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'timeline_title', label_text = 'Timeline';
        
DELETE FROM bom_translation WHERE guid='566e232ea3fd0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea3fd0','ko','label_text','연대표','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4157','people_filter','social_identification','Social Identification')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'social_identification', label_text = 'Social Identification';
        
DELETE FROM bom_translation WHERE guid='566e232ea4157' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4157','ko','label_text','사회 식별','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea424f','people_filter','jaredite','Jaredite')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'jaredite', label_text = 'Jaredite';
        
DELETE FROM bom_translation WHERE guid='566e232ea424f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea424f','ko','label_text','야렛인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea42c8','people_filter','nephite','Nephite')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'nephite', label_text = 'Nephite';
        
DELETE FROM bom_translation WHERE guid='566e232ea42c8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea42c8','ko','label_text','니파이인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4344','people_filter','lamanite','Lamanite')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'lamanite', label_text = 'Lamanite';
        
DELETE FROM bom_translation WHERE guid='566e232ea4344' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4344','ko','label_text','레이맨인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea43c0','people_filter','gadianton','Gadianton')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'gadianton', label_text = 'Gadianton';
        
DELETE FROM bom_translation WHERE guid='566e232ea43c0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea43c0','ko','label_text','개다이앤톤','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea44b8','people_filter','social_classification','Social Classification')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'social_classification', label_text = 'Social Classification';
        
DELETE FROM bom_translation WHERE guid='566e232ea44b8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea44b8','ko','label_text','사회 분류','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4534','people_filter','royalty','Royalty')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'royalty', label_text = 'Royalty';
        
DELETE FROM bom_translation WHERE guid='566e232ea4534' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4534','ko','label_text','왕족','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4633','people_filter','record_keeper','Record-Keeper')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'record_keeper', label_text = 'Record-Keeper';
        
DELETE FROM bom_translation WHERE guid='566e232ea4633' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4633','ko','label_text','기록 보관 인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea46bd','people_filter','warrior','Warrior')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'warrior', label_text = 'Warrior';
        
DELETE FROM bom_translation WHERE guid='566e232ea46bd' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea46bd','ko','label_text','전사','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4739','people_filter','judge','Judge')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'judge', label_text = 'Judge';
        
DELETE FROM bom_translation WHERE guid='566e232ea4739' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4739','ko','label_text','판사','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea47b5','progress','time_ago_date_format','ddd, D MMM YYYY [at] h:mma')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'time_ago_date_format', label_text = 'ddd, D MMM YYYY [at] h:mma';
        
DELETE FROM bom_translation WHERE guid='566e232ea47b5' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea47b5','ko','label_text','YYYY년 M월 D일  hh:mm','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea48d9','people_filter','individual','Individual')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'individual', label_text = 'Individual';
        
DELETE FROM bom_translation WHERE guid='566e232ea48d9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea48d9','ko','label_text','개인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4965','people_filter','group','Group')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'group', label_text = 'Group';
        
DELETE FROM bom_translation WHERE guid='566e232ea4965' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4965','ko','label_text','그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea49e7','people_filter','organization','Organization')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'organization', label_text = 'Organization';
        
DELETE FROM bom_translation WHERE guid='566e232ea49e7' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea49e7','ko','label_text','조직','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4a63','people_filter','society','Society')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'society', label_text = 'Society';
        
DELETE FROM bom_translation WHERE guid='566e232ea4a63' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4a63','ko','label_text','사회','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4ada','people_filter','civilization','Civilization')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'civilization', label_text = 'Civilization';
        
DELETE FROM bom_translation WHERE guid='566e232ea4ada' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4ada','ko','label_text','문명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea4c50','people_filter','filters','Filters')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'filters', label_text = 'Filters';
        
DELETE FROM bom_translation WHERE guid='566e232ea4c50' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea4c50','ko','label_text','필터','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea5154','people_filter','old_world','Old World')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'old_world', label_text = 'Old World';
        
DELETE FROM bom_translation WHERE guid='566e232ea5154' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea5154','ko','label_text','구대륙','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea51d7','geo_filter','land_of_desolation','Land of Desolation')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'land_of_desolation', label_text = 'Land of Desolation';
        
DELETE FROM bom_translation WHERE guid='566e232ea51d7' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea51d7','ko','label_text','황무 땅','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea524f','geo_filter','land_bountiful','Land Bountiful')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'land_bountiful', label_text = 'Land Bountiful';
        
DELETE FROM bom_translation WHERE guid='566e232ea524f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea524f','ko','label_text','풍요 땅','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea52c9','geo_filter','land_of_zarahemla','Land of Zarahemla')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'land_of_zarahemla', label_text = 'Land of Zarahemla';
        
DELETE FROM bom_translation WHERE guid='566e232ea52c9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea52c9','ko','label_text','제이라헤믈라 땅','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea5344','geo_filter','land_of_nephi','Land of Nephi')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'land_of_nephi', label_text = 'Land of Nephi';
        
DELETE FROM bom_translation WHERE guid='566e232ea5344' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea5344','ko','label_text','니파이의 땅','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea5439','people_filter','occupants','Occupants')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'occupants', label_text = 'Occupants';
        
DELETE FROM bom_translation WHERE guid='566e232ea5439' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea5439','ko','label_text','거주자','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea54af','people_filter','israelites','Israelites')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'israelites', label_text = 'Israelites';
        
DELETE FROM bom_translation WHERE guid='566e232ea54af' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea54af','ko','label_text','이스라엘인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea554a','people_filter','jaredites','Jaredites')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'jaredites', label_text = 'Jaredites';
        
DELETE FROM bom_translation WHERE guid='566e232ea554a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea554a','ko','label_text','야렛인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea55c4','people_filter','mulekites','Mulekites')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'mulekites', label_text = 'Mulekites';
        
DELETE FROM bom_translation WHERE guid='566e232ea55c4' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea55c4','ko','label_text','뮬레크인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea563d','people_filter','nephites','Nephites')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'nephites', label_text = 'Nephites';
        
DELETE FROM bom_translation WHERE guid='566e232ea563d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea563d','ko','label_text','니파이인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea56b9','people_filter','lamanites','Lamanites')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'lamanites', label_text = 'Lamanites';
        
DELETE FROM bom_translation WHERE guid='566e232ea56b9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea56b9','ko','label_text','레이맨인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea5c36','menu','contact_form','Contact Form')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'contact_form', label_text = 'Contact Form';
        
DELETE FROM bom_translation WHERE guid='566e232ea5c36' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea5c36','ko','label_text','문의 양식','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea5c49','menu','menu_more','More')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_more', label_text = 'More';
        
DELETE FROM bom_translation WHERE guid='566e232ea5c49' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea5c49','ko','label_text','키타','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea5c50','menu','title_more','Additional Contents')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'title_more', label_text = 'Additional Contents';
        
DELETE FROM bom_translation WHERE guid='566e232ea5c50' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea5c50','ko','label_text','추가 내용','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea6f3e','progress','started','Started')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'started', label_text = 'Started';
        
DELETE FROM bom_translation WHERE guid='566e232ea6f3e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea6f3e','ko','label_text','시작','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7140','menu','menu_history','History')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_history', label_text = 'History';
        
DELETE FROM bom_translation WHERE guid='566e232ea7140' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7140','ko','label_text','역사','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea71bb','menu','menu_analysis','Analysis')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_analysis', label_text = 'Analysis';
        
DELETE FROM bom_translation WHERE guid='566e232ea71bb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea71bb','ko','label_text','분석','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7237','menu','menu_study','Study')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'menu_study', label_text = 'Study';
        
DELETE FROM bom_translation WHERE guid='566e232ea7237' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7237','ko','label_text','학습','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea72b3','user','pasword_requirements','Password must contain at least eight characters, at least one number, both lower and uppercase letters and at least one special characters.')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'pasword_requirements', label_text = 'Password must contain at least eight characters, at least one number, both lower and uppercase letters and at least one special characters.';
        
DELETE FROM bom_translation WHERE guid='566e232ea72b3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea72b3','ko','label_text','비밀번호는 최소 8자, 숫자 1자, 소문자 및 대문자, 특수 문자를 하나 이상 포함해야 합니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea732e','study','action_cancel','Cancel')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'action_cancel', label_text = 'Cancel';
        
DELETE FROM bom_translation WHERE guid='566e232ea732e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea732e','ko','label_text','취소','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea73aa','study','action_delete','Delete')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'action_delete', label_text = 'Delete';
        
DELETE FROM bom_translation WHERE guid='566e232ea73aa' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea73aa','ko','label_text','삭제','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7434','study','action_edit','Edit')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'action_edit', label_text = 'Edit';
        
DELETE FROM bom_translation WHERE guid='566e232ea7434' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7434','ko','label_text','수정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea74af','study','action_like','Like')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'action_like', label_text = 'Like';
        
DELETE FROM bom_translation WHERE guid='566e232ea74af' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea74af','ko','label_text','좋아요','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea752f','study','action_reply','Reply')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'action_reply', label_text = 'Reply';
        
DELETE FROM bom_translation WHERE guid='566e232ea752f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea752f','ko','label_text','답글 달기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea75a6','study','action_unlike','Unlike')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'action_unlike', label_text = 'Unlike';
        
DELETE FROM bom_translation WHERE guid='566e232ea75a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea75a6','ko','label_text','좋아요 취소','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7627','study','cancel','Cancel')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'cancel', label_text = 'Cancel';
        
DELETE FROM bom_translation WHERE guid='566e232ea7627' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7627','ko','label_text','취소','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea76a0','user','change_password','Change Password')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'change_password', label_text = 'Change Password';
        
DELETE FROM bom_translation WHERE guid='566e232ea76a0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea76a0','ko','label_text','비밀번호 변경','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7736','general','coming_soon','Coming Soon')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'coming_soon', label_text = 'Coming Soon';
        
DELETE FROM bom_translation WHERE guid='566e232ea7736' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7736','ko','label_text','근일 개봉','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea77cc','progress','completed','Completed')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'completed', label_text = 'Completed';
        
DELETE FROM bom_translation WHERE guid='566e232ea77cc' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea77cc','ko','label_text','완료','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7862','progress','completed_on','completed on')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'completed_on', label_text = 'completed on';
        
DELETE FROM bom_translation WHERE guid='566e232ea7862' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7862','ko','label_text','완료','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea78eb','user','confirm_password','Confirm Password')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'confirm_password', label_text = 'Confirm Password';
        
DELETE FROM bom_translation WHERE guid='566e232ea78eb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea78eb','ko','label_text','비밀번호 확인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7967','user','connected_accounts','Connected Accounts')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'connected_accounts', label_text = 'Connected Accounts';
        
DELETE FROM bom_translation WHERE guid='566e232ea7967' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7967','ko','label_text','연결된 계정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea79e3','menu','contact','Contact')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'contact', label_text = 'Contact';
        
DELETE FROM bom_translation WHERE guid='566e232ea79e3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea79e3','ko','label_text','연락처','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7a5f','general','copied_to_clipboard','Copied to clipboard')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'copied_to_clipboard', label_text = 'Copied to clipboard';
        
DELETE FROM bom_translation WHERE guid='566e232ea7a5f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7a5f','ko','label_text','클립보드에 복사됨','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7ade','user','date_started','Date started')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'date_started', label_text = 'Date started';
        
DELETE FROM bom_translation WHERE guid='566e232ea7ade' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7ade','ko','label_text','가입 날짜','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7b5e','study_group','discussion','Discussion')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'discussion', label_text = 'Discussion';
        
DELETE FROM bom_translation WHERE guid='566e232ea7b5e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7b5e','ko','label_text','토론','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7bae','user','tab_profile','Profile')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'tab_profile', label_text = 'Profile';
        
DELETE FROM bom_translation WHERE guid='566e232ea7bae' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7bae','ko','label_text','프로필','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7ba2','user','tab_progress','Progress')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'tab_progress', label_text = 'Progress';
        
DELETE FROM bom_translation WHERE guid='566e232ea7ba2' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7ba2','ko','label_text','진도','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7ba3','user','tab_prefs','Preferences')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'tab_prefs', label_text = 'Preferences';
        
DELETE FROM bom_translation WHERE guid='566e232ea7ba3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7ba3','ko','label_text','설정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7bdf','user','edit_profile','Edit Profile')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'edit_profile', label_text = 'Edit Profile';
        
DELETE FROM bom_translation WHERE guid='566e232ea7bdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7bdf','ko','label_text','프로필 수정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7c5d','user','email','Email')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'email', label_text = 'Email';
        
DELETE FROM bom_translation WHERE guid='566e232ea7c5d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7c5d','ko','label_text','이메일','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7cdf','user','facebook','Facebook')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'facebook', label_text = 'Facebook';
        
DELETE FROM bom_translation WHERE guid='566e232ea7cdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7cdf','ko','label_text','페이스북','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7d67','user','google','Google')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'google', label_text = 'Google';
        
DELETE FROM bom_translation WHERE guid='566e232ea7d67' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7d67','ko','label_text','구글','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7dde','user','instagram','Instagram')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'instagram', label_text = 'Instagram';
        
DELETE FROM bom_translation WHERE guid='566e232ea7dde' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7dde','ko','label_text','인스타그램','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7e64','user','invite','Invite')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'invite', label_text = 'Invite';
        
DELETE FROM bom_translation WHERE guid='566e232ea7e64' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7e64','ko','label_text','초대','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7ede','study_group','last_seen','Last seen:')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'last_seen', label_text = 'Last seen:';
        
DELETE FROM bom_translation WHERE guid='566e232ea7ede' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7ede','ko','label_text','최근접속일시','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea7f74','study_group','loading_groups','Loading Groups...')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'loading_groups', label_text = 'Loading Groups...';
        
DELETE FROM bom_translation WHERE guid='566e232ea7f74' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea7f74','ko','label_text','스터디 그룹들 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea800a','user','log_out','Log out')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'log_out', label_text = 'Log out';
        
DELETE FROM bom_translation WHERE guid='566e232ea800a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea800a','ko','label_text','로그아웃','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea8094','user','login','Login')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'login', label_text = 'Login';
        
DELETE FROM bom_translation WHERE guid='566e232ea8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea8094','ko','label_text','로그인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea8110','study_group','message_thread','Message Thread')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'message_thread', label_text = 'Message Thread';
        
DELETE FROM bom_translation WHERE guid='566e232ea8110' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea8110','ko','label_text','글타래','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea81a6','user','name','Name')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'name', label_text = 'Name';
        
DELETE FROM bom_translation WHERE guid='566e232ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea81a6','ko','label_text','이름','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea8222','user','new_password','New password')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'new_password', label_text = 'New password';
        
DELETE FROM bom_translation WHERE guid='566e232ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea8222','ko','label_text','새 비밀번호','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea8299','study_group','notebook','Notebook')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'notebook', label_text = 'Notebook';
        
DELETE FROM bom_translation WHERE guid='566e232ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea8299','ko','label_text','메모장','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea8312','user','notifications','Notifications')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'notifications', label_text = 'Notifications';
        
DELETE FROM bom_translation WHERE guid='566e232ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea8312','ko','label_text','알림','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('566e232ea838e','user','password_login','Password login')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'password_login', label_text = 'Password login';
        
DELETE FROM bom_translation WHERE guid='566e232ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('566e232ea838e','ko','label_text','회원 로그인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea209f','user','passwords_no_match','Passwords do not match')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'passwords_no_match', label_text = 'Passwords do not match';
        
DELETE FROM bom_translation WHERE guid='733e232ea209f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea209f','ko','label_text','비밀번호가 일치하지 않습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea211d','user','patreon','Patreon')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'patreon', label_text = 'Patreon';
        
DELETE FROM bom_translation WHERE guid='733e232ea211d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea211d','ko','label_text','파트레온','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea219b','user','privacy_policy_review_x','Please review the $1')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'privacy_policy_review_x', label_text = 'Please review the $1';
        
DELETE FROM bom_translation WHERE guid='733e232ea219b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea219b','ko','label_text','$1을 검토하십시오.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2217','study_group','read_only','Read-only mode')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'read_only', label_text = 'Read-only mode';
        
DELETE FROM bom_translation WHERE guid='733e232ea2217' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2217','ko','label_text','읽기 전용 모드','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2292','study_group','reply_count_plural','Replies')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'reply_count_plural', label_text = 'Replies';
        
DELETE FROM bom_translation WHERE guid='733e232ea2292' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2292','ko','label_text','답글 1개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2317','study_group','reply_count_singular','Reply')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'reply_count_singular', label_text = 'Reply';
        
DELETE FROM bom_translation WHERE guid='733e232ea2317' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2317','ko','label_text','답글 $2개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2393','general','save','Save')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'save', label_text = 'Save';
        
DELETE FROM bom_translation WHERE guid='733e232ea2393' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2393','ko','label_text','저장','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2409','study_group','share_group_link','Share this secret link to invite others')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'share_group_link', label_text = 'Share this secret link to invite others';
        
DELETE FROM bom_translation WHERE guid='733e232ea2409' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2409','ko','label_text','이 비밀 링크를 공유하여 다른 사용자를 초대합니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2408','study_group','studygroup_invite','$1 study group invitation')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'studygroup_invite', label_text = '$1 study group invitation';
        
DELETE FROM bom_translation WHERE guid='733e232ea2408' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2408','ko','label_text','$1 그룹 초대장','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea248c','user','signup','Sign-up')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'signup', label_text = 'Sign-up';
        
DELETE FROM bom_translation WHERE guid='733e232ea248c' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea248c','ko','label_text','가입','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2505','user','social_login','Social Login')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'social_login', label_text = 'Social Login';
        
DELETE FROM bom_translation WHERE guid='733e232ea2505' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2505','ko','label_text','SNS 로그인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2580','user','social_media','Social Media')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'social_media', label_text = 'Social Media';
        
DELETE FROM bom_translation WHERE guid='733e232ea2580' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2580','ko','label_text','SNS','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea25fc','study_group','study_hall','Study Hall')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'study_hall', label_text = 'Study Hall';
        
DELETE FROM bom_translation WHERE guid='733e232ea25fc' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea25fc','ko','label_text','학습실','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2677','study_group','study_history','Study History')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'study_history', label_text = 'Study History';
        
DELETE FROM bom_translation WHERE guid='733e232ea2677' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2677','ko','label_text','학습 기록','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea26f3','study_group','study_history_for','Study History for $1')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'study_history_for', label_text = 'Study History for $1';
        
DELETE FROM bom_translation WHERE guid='733e232ea26f3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea26f3','ko','label_text','$1님의 학습 기록','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2779','progress','study_progress','Study Progress')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'study_progress', label_text = 'Study Progress';
        
DELETE FROM bom_translation WHERE guid='733e232ea2779' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2779','ko','label_text','학습 진행 상태','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea27f0','progress','study_sessions','Study sessions')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'study_sessions', label_text = 'Study sessions';
        
DELETE FROM bom_translation WHERE guid='733e232ea27f0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea27f0','ko','label_text','학습 횟수','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2870','progress','study_time','Study time')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'study_time', label_text = 'Study time';
        
DELETE FROM bom_translation WHERE guid='733e232ea2870' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2870','ko','label_text','총 학습 시간','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea28e9','title','title_analysis','Book of Mormon Analysis')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_analysis', label_text = 'Book of Mormon Analysis';
        
DELETE FROM bom_translation WHERE guid='733e232ea28e9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea28e9','ko','label_text','몰몬경 분석서','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2965','title','title_facsimilies','Facsimilies of Historical Book of Mormon Editions')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_facsimilies', label_text = 'Facsimilies of Historical Book of Mormon Editions';
        
DELETE FROM bom_translation WHERE guid='733e232ea2965' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2965','ko','label_text','몰몬경 전의 판 사본','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea29e2','title','title_history','Historical Sources Relating to the Book of Mormon')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_history', label_text = 'Historical Sources Relating to the Book of Mormon';
        
DELETE FROM bom_translation WHERE guid='733e232ea29e2' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea29e2','ko','label_text','몰몬경에 대한 역사적 출처','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea29e3','history','archived_document','Archived document')
        ON DUPLICATE KEY UPDATE
         type = 'history', label_id = 'archived_document', label_text = 'Archived document';
        
DELETE FROM bom_translation WHERE guid='733e232ea29e3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea29e3','ko','label_text','역사적 문서','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2a5f','title','title_search_results','Search Results for $1')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_search_results', label_text = 'Search Results for $1';
        
DELETE FROM bom_translation WHERE guid='733e232ea2a5f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2a5f','ko','label_text','$1에 대한 검색 결과','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2adb','title','title_study_history','Study History')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_study_history', label_text = 'Study History';
        
DELETE FROM bom_translation WHERE guid='733e232ea2adb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2adb','ko','label_text','학습 기록','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2b57','title','title_tos','Book of Mormon Online—Terms of Service')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_tos', label_text = 'Book of Mormon Online—Terms of Service';
        
DELETE FROM bom_translation WHERE guid='733e232ea2b57' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2b57','ko','label_text','몰몬경.KR—서비스 약관','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2bdf','study_group','tooltip_discussion','Study group discussion')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'tooltip_discussion', label_text = 'Study group discussion';
        
DELETE FROM bom_translation WHERE guid='733e232ea2bdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2bdf','ko','label_text','스터디 그룹 토론','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2bd0','study_group','tooltip_admin','Study group administration')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'tooltip_admin', label_text = 'Study group administration';
        
DELETE FROM bom_translation WHERE guid='733e232ea2bd0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2bd0','ko','label_text','스터디 그룹 관리','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2c5b','study_group','tooltip_notebook','Study group Notebook')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'tooltip_notebook', label_text = 'Study group Notebook';
        
DELETE FROM bom_translation WHERE guid='733e232ea2c5b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2c5b','ko','label_text','스터디 그룹 노트북','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2cd7','study_group','tooltip_progress','Study group progress')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'tooltip_progress', label_text = 'Study group progress';
        
DELETE FROM bom_translation WHERE guid='733e232ea2cd7' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2cd7','ko','label_text','스터디 그룹 진행률','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2d58','user','tos_agree','By signing up, you agree to the terms of service')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'tos_agree', label_text = 'By signing up, you agree to the terms of service';
        
DELETE FROM bom_translation WHERE guid='733e232ea2d58' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2d58','ko','label_text','가입하면 $1 서비스 약관에 동의하는 것입니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2dcf','progress','trophy_case','Trophy Case')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'trophy_case', label_text = 'Trophy Case';
        
DELETE FROM bom_translation WHERE guid='733e232ea2dcf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2dcf','ko','label_text','트로피 보관함','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2e50','user','twitter','Twitter')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'twitter', label_text = 'Twitter';
        
DELETE FROM bom_translation WHERE guid='733e232ea2e50' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2e50','ko','label_text','트위터','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('733e232ea2eca','user','zip_code','Zip Code')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'zip_code', label_text = 'Zip Code';
        
DELETE FROM bom_translation WHERE guid='733e232ea2eca' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('733e232ea2eca','ko','label_text','우편번호','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea200b','user','privacy_policy','privacy policy')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'privacy_policy', label_text = 'privacy policy';
        
DELETE FROM bom_translation WHERE guid='931e232ea200b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea200b','ko','label_text','개인 정보 보호 정책','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea200a','user','terms_of_service','terms of service')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'terms_of_service', label_text = 'terms of service';
        
DELETE FROM bom_translation WHERE guid='931e232ea200a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea200a','ko','label_text','서비스 약관','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea219b','page','save_highlight_plural','Save highlights')
        ON DUPLICATE KEY UPDATE
         type = 'page', label_id = 'save_highlight_plural', label_text = 'Save highlights';
        
DELETE FROM bom_translation WHERE guid='931e232ea219b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea219b','ko','label_text','하이라이트 저장','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea219a','page','save_highlight_singular','Save highlight')
        ON DUPLICATE KEY UPDATE
         type = 'page', label_id = 'save_highlight_singular', label_text = 'Save highlight';
        
DELETE FROM bom_translation WHERE guid='931e232ea219a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea219a','ko','label_text','선택글 저장','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2217','page','highlight_image','Highlight image')
        ON DUPLICATE KEY UPDATE
         type = 'page', label_id = 'highlight_image', label_text = 'Highlight image';
        
DELETE FROM bom_translation WHERE guid='931e232ea2217' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2217','ko','label_text','이미지 강조 표시','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2292','page','highlight_facsimile','Highlight facsimile')
        ON DUPLICATE KEY UPDATE
         type = 'page', label_id = 'highlight_facsimile', label_text = 'Highlight facsimile';
        
DELETE FROM bom_translation WHERE guid='931e232ea2292' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2292','ko','label_text','사본 강조 표시','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2293','study','write_a_comment','Write a comment')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'write_a_comment', label_text = 'Write a comment';
        
DELETE FROM bom_translation WHERE guid='931e232ea2293' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2293','ko','label_text','댓글을 입력하세요...','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2316','study_group','loading_x_more_comments','Loading $1 More Comments...')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'loading_x_more_comments', label_text = 'Loading $1 More Comments...';
        
DELETE FROM bom_translation WHERE guid='931e232ea2316' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2316','ko','label_text','댓글 $1개 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2317','study_group','view_x_more_comments','View $1 More Comments')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'view_x_more_comments', label_text = 'View $1 More Comments';
        
DELETE FROM bom_translation WHERE guid='931e232ea2317' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2317','ko','label_text','댓글 $1개 더 보기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2407','study_group','highlighting','Highlighting')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'highlighting', label_text = 'Highlighting';
        
DELETE FROM bom_translation WHERE guid='931e232ea2407' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2407','ko','label_text','선택 저장 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2409','study_group','saving','Saving')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'saving', label_text = 'Saving';
        
DELETE FROM bom_translation WHERE guid='931e232ea2409' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2409','ko','label_text','저장 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea248a','study_group','add_a_comment','Add a Comment')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'add_a_comment', label_text = 'Add a Comment';
        
DELETE FROM bom_translation WHERE guid='931e232ea248a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea248a','ko','label_text','댓글 입력','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2505','study_group','advanced_editor','Advanced Editor')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'advanced_editor', label_text = 'Advanced Editor';
        
DELETE FROM bom_translation WHERE guid='931e232ea2505' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2505','ko','label_text','고급 편집기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2504','study_group','send','Send')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'send', label_text = 'Send';
        
DELETE FROM bom_translation WHERE guid='931e232ea2504' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2504','ko','label_text','보내기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2581','study_group','new_group','New Group')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'new_group', label_text = 'New Group';
        
DELETE FROM bom_translation WHERE guid='931e232ea2581' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2581','ko','label_text','새 스터디 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea2580','study_group','study_mode','Study Mode')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'study_mode', label_text = 'Study Mode';
        
DELETE FROM bom_translation WHERE guid='931e232ea2580' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea2580','ko','label_text','학습 모드','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea31b8','study_group','is_online','Is Online')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'is_online', label_text = 'Is Online';
        
DELETE FROM bom_translation WHERE guid='931e232ea31b8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea31b8','ko','label_text','접속중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea31b9','study_group','online_count','$1 Online')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'online_count', label_text = '$1 Online';
        
DELETE FROM bom_translation WHERE guid='931e232ea31b9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea31b9','ko','label_text','온라인 $1 명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea31b0','study_group','xs_study_groups','$1’s Study Groups')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'xs_study_groups', label_text = '$1’s Study Groups';
        
DELETE FROM bom_translation WHERE guid='931e232ea31b0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea31b0','ko','label_text','$1님의 스터디 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3433','study_group','create_new_study_group','Create New Study Group')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'create_new_study_group', label_text = 'Create New Study Group';
        
DELETE FROM bom_translation WHERE guid='931e232ea3433' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3433','ko','label_text','스터디 그룹만들기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3431','study_group','member_plural','$1 Members')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'member_plural', label_text = '$1 Members';
        
DELETE FROM bom_translation WHERE guid='931e232ea3431' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3431','ko','label_text','회원 $1명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3434','study_group','member_singular','$1 Member')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'member_singular', label_text = '$1 Member';
        
DELETE FROM bom_translation WHERE guid='931e232ea3434' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3434','ko','label_text','회원 $1명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35a4','general','optional','Optional')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'optional', label_text = 'Optional';
        
DELETE FROM bom_translation WHERE guid='931e232ea35a4' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35a4','ko','label_text','선택 사항','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35b6','general','back','Back')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'back', label_text = 'Back';
        
DELETE FROM bom_translation WHERE guid='931e232ea35b6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35b6','ko','label_text','이전','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35a5','progress','status_done','Status Done')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'status_done', label_text = 'Status Done';
        
DELETE FROM bom_translation WHERE guid='931e232ea35a5' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35a5','ko','label_text','완료 상태','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea18a5','general','fax_edition','Digital Facsimile')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'fax_edition', label_text = 'Digital Facsimile';
        
DELETE FROM bom_translation WHERE guid='931e232ea18a5' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea18a5','ko','label_text','사본 스캔','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35a6','study_group','creating_group','Creating Group')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'creating_group', label_text = 'Creating Group';
        
DELETE FROM bom_translation WHERE guid='931e232ea35a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35a6','ko','label_text','그룹 만들기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35a7','study_group','new_study_group_description','New Study Group Description')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'new_study_group_description', label_text = 'New Study Group Description';
        
DELETE FROM bom_translation WHERE guid='931e232ea35a7' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35a7','ko','label_text','스터디 그룹 설명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35a8','study_group','new_study_group_icon','New Study Group Icon')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'new_study_group_icon', label_text = 'New Study Group Icon';
        
DELETE FROM bom_translation WHERE guid='931e232ea35a8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35a8','ko','label_text','스터디 그룹 아이콘','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35a9','study_group','new_study_group_name','New Study Group Name')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'new_study_group_name', label_text = 'New Study Group Name';
        
DELETE FROM bom_translation WHERE guid='931e232ea35a9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35a9','ko','label_text','스터디 그룹 명칭','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35b1','study_group','new_study_group_type','New Study Group Type')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'new_study_group_type', label_text = 'New Study Group Type';
        
DELETE FROM bom_translation WHERE guid='931e232ea35b1' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35b1','ko','label_text','새 스터디 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35ff','study_group','who_group_for','Who is this group for?')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'who_group_for', label_text = 'Who is this group for?';
        
DELETE FROM bom_translation WHERE guid='931e232ea35ff' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35ff','ko','label_text','스터디 그룹 대상자 누굴까요?','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea35b2','study_group','no_name','No Name')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'no_name', label_text = 'No Name';
        
DELETE FROM bom_translation WHERE guid='931e232ea35b2' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea35b2','ko','label_text','명칭 필수','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3620','study_group','group_type_private','Private')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_private', label_text = 'Private';
        
DELETE FROM bom_translation WHERE guid='931e232ea3620' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3620','ko','label_text','비공개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3621','study_group','group_type_private_desc','An invite-only group that only members can see.')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_private_desc', label_text = 'An invite-only group that only members can see.';
        
DELETE FROM bom_translation WHERE guid='931e232ea3621' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3621','ko','label_text','구성원만 볼 수 있는 초대 전용 스터디 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3622','study_group','group_type_public','Public')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_public', label_text = 'Public';
        
DELETE FROM bom_translation WHERE guid='931e232ea3622' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3622','ko','label_text','공용','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3623','study_group','group_type_public_desc','An invite-only group that anyone can see and follow.')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_public_desc', label_text = 'An invite-only group that anyone can see and follow.';
        
DELETE FROM bom_translation WHERE guid='931e232ea3623' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3623','ko','label_text','모든 사용자가 보고 팔로우할 수 있는 초대 전용 스터디 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3624','study_group','group_type_solo','Solo')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_solo', label_text = 'Solo';
        
DELETE FROM bom_translation WHERE guid='931e232ea3624' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3624','ko','label_text','개인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3625','study_group','group_type_solo_desc','A 1-person study space just for you.')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_solo_desc', label_text = 'A 1-person study space just for you.';
        
DELETE FROM bom_translation WHERE guid='931e232ea3625' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3625','ko','label_text','본인을 위한 1인 학습 공간','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3796','study_group','group_type_open','Open')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_open', label_text = 'Open';
        
DELETE FROM bom_translation WHERE guid='931e232ea3796' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3796','ko','label_text','오픈','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3fa1','page','commentary_singular','Commentary')
        ON DUPLICATE KEY UPDATE
         type = 'page', label_id = 'commentary_singular', label_text = 'Commentary';
        
DELETE FROM bom_translation WHERE guid='931e232ea3fa1' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3fa1','ko','label_text','해설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3fa2','study_group','facsimiles_of_x','Facsimiles of $1')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'facsimiles_of_x', label_text = 'Facsimiles of $1';
        
DELETE FROM bom_translation WHERE guid='931e232ea3fa2' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3fa2','ko','label_text','$1의 사본','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3fa3','study_group','group_type_open_desc','An open-invite group that anyone can join or follow.')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_type_open_desc', label_text = 'An open-invite group that anyone can join or follow.';
        
DELETE FROM bom_translation WHERE guid='931e232ea3fa3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3fa3','ko','label_text','누구나 보고 가입하고 참여할 수 있는 스터디 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3fa4','study_group','message_x','Message $1')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'message_x', label_text = 'Message $1';
        
DELETE FROM bom_translation WHERE guid='931e232ea3fa4' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3fa4','ko','label_text','$1님에게 문자 보내기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea3fa5','study_group','share_group_link_to_x','Share link to $1')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'share_group_link_to_x', label_text = 'Share link to $1';
        
DELETE FROM bom_translation WHERE guid='931e232ea3fa5' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea3fa5','ko','label_text','$1에 대한 공유 링크','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4157','page','commentary_plural','Commentaries')
        ON DUPLICATE KEY UPDATE
         type = 'page', label_id = 'commentary_plural', label_text = 'Commentaries';
        
DELETE FROM bom_translation WHERE guid='931e232ea4157' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4157','ko','label_text','해설들','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea41ce','people_filter','other','Other')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'other', label_text = 'Other';
        
DELETE FROM bom_translation WHERE guid='931e232ea41ce' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea41ce','ko','label_text','기타','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea424f','people_filter','priest','Minister')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'priest', label_text = 'Minister';
        
DELETE FROM bom_translation WHERE guid='931e232ea424f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea424f','ko','label_text','성직자','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4243','people_filter','prophet','Prophet')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'prophet', label_text = 'Prophet';
        
DELETE FROM bom_translation WHERE guid='931e232ea4243' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4243','ko','label_text','선지자','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea42c1','people_filter','israelite','Israelite')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'israelite', label_text = 'Israelite';
        
DELETE FROM bom_translation WHERE guid='931e232ea42c1' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea42c1','ko','label_text','이스라엘 사람','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea42c8','people_filter','social_unit','Social Unit')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'social_unit', label_text = 'Social Unit';
        
DELETE FROM bom_translation WHERE guid='931e232ea42c8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea42c8','ko','label_text','사회 단위','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4344','people_filter','biblical','Biblical')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'biblical', label_text = 'Biblical';
        
DELETE FROM bom_translation WHERE guid='931e232ea4344' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4344','ko','label_text','성경의','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e2323t4343','people_filter','ane','Ancient Near East')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'ane', label_text = 'Ancient Near East';
        
DELETE FROM bom_translation WHERE guid='931e2323t4343' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e2323t4343','ko','label_text','고대 근동','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4343','people_filter','spiritual','Spiritual')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'spiritual', label_text = 'Spiritual';
        
DELETE FROM bom_translation WHERE guid='931e232ea4343' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4343','ko','label_text','영적','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea43c0','general','off','Off')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'off', label_text = 'Off';
        
DELETE FROM bom_translation WHERE guid='931e232ea43c0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea43c0','ko','label_text','꺼짐','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea43c1','people_filter','select_all','Select All')
        ON DUPLICATE KEY UPDATE
         type = 'people_filter', label_id = 'select_all', label_text = 'Select All';
        
DELETE FROM bom_translation WHERE guid='931e232ea43c1' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea43c1','ko','label_text','모두 선택','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea44b8','general','on','On')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'on', label_text = 'On';
        
DELETE FROM bom_translation WHERE guid='931e232ea44b8' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea44b8','ko','label_text','켜짐','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4534','title','title_people','People in the Book of Mormon')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_people', label_text = 'People in the Book of Mormon';
        
DELETE FROM bom_translation WHERE guid='931e232ea4534' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4534','ko','label_text','몰몬경에 나오는 인물','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4633','menu','search','Search')
        ON DUPLICATE KEY UPDATE
         type = 'menu', label_id = 'search', label_text = 'Search';
        
DELETE FROM bom_translation WHERE guid='931e232ea4633' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4633','ko','label_text','검색','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea46bd','geo_filter','greater_locale','Greater Locale')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'greater_locale', label_text = 'Greater Locale';
        
DELETE FROM bom_translation WHERE guid='931e232ea46bd' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea46bd','ko','label_text','더 큰 로케일','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4739','geo_filter','land_of_first_Inheritance','Land of First Inheritance')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'land_of_first_Inheritance', label_text = 'Land of First Inheritance';
        
DELETE FROM bom_translation WHERE guid='931e232ea4739' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4739','ko','label_text','첫 번째 상속의 땅','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea47b5','geo_filter','geo_other','Other')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'geo_other', label_text = 'Other';
        
DELETE FROM bom_translation WHERE guid='931e232ea47b5' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea47b5','ko','label_text','기타','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea48d9','geo_filter','mulekite','Mulekite')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'mulekite', label_text = 'Mulekite';
        
DELETE FROM bom_translation WHERE guid='931e232ea48d9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea48d9','ko','label_text','뮬카이트','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea49e7','geo_filter','geo_type','Geo Type')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'geo_type', label_text = 'Geo Type';
        
DELETE FROM bom_translation WHERE guid='931e232ea49e7' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea49e7','ko','label_text','지역 유형','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4a63','geo_filter','nation','Nation')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'nation', label_text = 'Nation';
        
DELETE FROM bom_translation WHERE guid='931e232ea4a63' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4a63','ko','label_text','국가','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4ada','geo_filter','land','Land')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'land', label_text = 'Land';
        
DELETE FROM bom_translation WHERE guid='931e232ea4ada' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4ada','ko','label_text','육지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea4c50','geo_filter','city','City')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'city', label_text = 'City';
        
DELETE FROM bom_translation WHERE guid='931e232ea4c50' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea4c50','ko','label_text','도시','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea5154','geo_filter','geographic_feature','Geographic Feature')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'geographic_feature', label_text = 'Geographic Feature';
        
DELETE FROM bom_translation WHERE guid='931e232ea5154' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea5154','ko','label_text','지리적 특징','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea5152','geo_filter','town','Town')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'town', label_text = 'Town';
        
DELETE FROM bom_translation WHERE guid='931e232ea5152' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea5152','ko','label_text','마을','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea51d7','geo_filter','gadiantons','Gadiantons')
        ON DUPLICATE KEY UPDATE
         type = 'geo_filter', label_id = 'gadiantons', label_text = 'Gadiantons';
        
DELETE FROM bom_translation WHERE guid='931e232ea51d7' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea51d7','ko','label_text','가디안톤스','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea524f','general','clear','Clear')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'clear', label_text = 'Clear';
        
DELETE FROM bom_translation WHERE guid='931e232ea524f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea524f','ko','label_text','치우기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea5344','general','selectors','Selectors')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'selectors', label_text = 'Selectors';
        
DELETE FROM bom_translation WHERE guid='931e232ea5344' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea5344','ko','label_text','셀렉터','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea5343','title','title_places','Places in the Book of Mormon')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'title_places', label_text = 'Places in the Book of Mormon';
        
DELETE FROM bom_translation WHERE guid='931e232ea5343' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea5343','ko','label_text','몰몬경에 나오는 장소','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea54af','progress','short_month_labels','Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'short_month_labels', label_text = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec';
        
DELETE FROM bom_translation WHERE guid='931e232ea54af' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea54af','ko','label_text','1월,2월,3월,4월,5월,6월,7월,8월,9월,10월,11월,12월','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea54a1','title','x_search_results_for_y','$1 search results for “$2”')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'x_search_results_for_y', label_text = '$1 search results for “$2”';
        
DELETE FROM bom_translation WHERE guid='931e232ea54a1' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea54a1','ko','label_text','“$2”에 대한 검색 결과 $1개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea54b2','title','no_results_for_x','No results for “$1”')
        ON DUPLICATE KEY UPDATE
         type = 'title', label_id = 'no_results_for_x', label_text = 'No results for “$1”';
        
DELETE FROM bom_translation WHERE guid='931e232ea54b2' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea54b2','ko','label_text','“$1”에 대한 검색 결과 없음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea554a','progress','completed_on_x','Completed on $1')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'completed_on_x', label_text = 'Completed on $1';
        
DELETE FROM bom_translation WHERE guid='931e232ea554a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea554a','ko','label_text','$1에 왕성되었음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea554b','progress','study_progress_for_x','Study progress for $1')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'study_progress_for_x', label_text = 'Study progress for $1';
        
DELETE FROM bom_translation WHERE guid='931e232ea554b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea554b','ko','label_text','$1님의 학습 진행률','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea563d','user','tos_agree_x','By signing up, you agree to the $1')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'tos_agree_x', label_text = 'By signing up, you agree to the $1';
        
DELETE FROM bom_translation WHERE guid='931e232ea563d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea563d','ko','label_text','가입하면 $1 서비스 약관에 동의하는 것입니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea56b9','user','idbadge','Idbadge')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'idbadge', label_text = 'Idbadge';
        
DELETE FROM bom_translation WHERE guid='931e232ea56b9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea56b9','ko','label_text','이드배지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea5c36','study_group','no_groups','No groups')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'no_groups', label_text = 'No groups';
        
DELETE FROM bom_translation WHERE guid='931e232ea5c36' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea5c36','ko','label_text','그룹 없음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea5c37','group','groups','Groups')
        ON DUPLICATE KEY UPDATE
         type = 'group', label_id = 'groups', label_text = 'Groups';
        
DELETE FROM bom_translation WHERE guid='931e232ea5c37' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea5c37','ko','label_text','그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea5c38','group','menu','Menu')
        ON DUPLICATE KEY UPDATE
         type = 'group', label_id = 'menu', label_text = 'Menu';
        
DELETE FROM bom_translation WHERE guid='931e232ea5c38' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea5c38','ko','label_text','메뉴','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea6f3e','general','loading','Loading...')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'loading', label_text = 'Loading...';
        
DELETE FROM bom_translation WHERE guid='931e232ea6f3e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea6f3e','ko','label_text','로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7140','progress','extracurricular_activities','Extracurricular activities')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'extracurricular_activities', label_text = 'Extracurricular activities';
        
DELETE FROM bom_translation WHERE guid='931e232ea7140' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7140','ko','label_text','과외 활동','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea71bb','user','loading_user','Loading user...')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'loading_user', label_text = 'Loading user...';
        
DELETE FROM bom_translation WHERE guid='931e232ea71bb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea71bb','ko','label_text','사용자 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7237','progress','mins','mins')
        ON DUPLICATE KEY UPDATE
         type = 'progress', label_id = 'mins', label_text = 'mins';
        
DELETE FROM bom_translation WHERE guid='931e232ea7237' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7237','ko','label_text','분','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea72b3','study_group','never','Never')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'never', label_text = 'Never';
        
DELETE FROM bom_translation WHERE guid='931e232ea72b3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea72b3','ko','label_text','없음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea732e','general','network_failure','Network failure')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'network_failure', label_text = 'Network failure';
        
DELETE FROM bom_translation WHERE guid='931e232ea732e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea732e','ko','label_text','네트워크 장애','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea73aa','social_login','kakao','Kakao')
        ON DUPLICATE KEY UPDATE
         type = 'social_login', label_id = 'kakao', label_text = 'Kakao';
        
DELETE FROM bom_translation WHERE guid='931e232ea73aa' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea73aa','ko','label_text','카카오','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea74af','social_login','naver','Naver')
        ON DUPLICATE KEY UPDATE
         type = 'social_login', label_id = 'naver', label_text = 'Naver';
        
DELETE FROM bom_translation WHERE guid='931e232ea74af' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea74af','ko','label_text','네이버','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea752f','user','guest','Guest')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'guest', label_text = 'Guest';
        
DELETE FROM bom_translation WHERE guid='931e232ea752f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea752f','ko','label_text','미가입자','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea75a6','user','logging_out','Logging out')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'logging_out', label_text = 'Logging out';
        
DELETE FROM bom_translation WHERE guid='931e232ea75a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea75a6','ko','label_text','로그아웃중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7627','user','preferences','Preferences')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'preferences', label_text = 'Preferences';
        
DELETE FROM bom_translation WHERE guid='931e232ea7627' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7627','ko','label_text','사용자 기본 설정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea76a0','user','audio','Audio')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'audio', label_text = 'Audio';
        
DELETE FROM bom_translation WHERE guid='931e232ea76a0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea76a0','ko','label_text','오디오','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7736','user','art','Illustrations')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'art', label_text = 'Illustrations';
        
DELETE FROM bom_translation WHERE guid='931e232ea7736' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7736','ko','label_text','삽화','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea77cc','user','commentary','Commentary')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'commentary', label_text = 'Commentary';
        
DELETE FROM bom_translation WHERE guid='931e232ea77cc' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea77cc','ko','label_text','해설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7862','user','inline_art','Inline Art')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'inline_art', label_text = 'Inline Art';
        
DELETE FROM bom_translation WHERE guid='931e232ea7862' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7862','ko','label_text','삽화','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea78eb','user','audio_on','Audio narration is on')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'audio_on', label_text = 'Audio narration is on';
        
DELETE FROM bom_translation WHERE guid='931e232ea78eb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea78eb','ko','label_text','음성 켜져 있음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7967','user','audio_off','Audio narration is off')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'audio_off', label_text = 'Audio narration is off';
        
DELETE FROM bom_translation WHERE guid='931e232ea7967' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7967','ko','label_text','음성 꺼져 있음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea79e3','user','user_prefs','User preferences')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'user_prefs', label_text = 'User preferences';
        
DELETE FROM bom_translation WHERE guid='931e232ea79e3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea79e3','ko','label_text','사용자 기본 설정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7a5f','user','sound_effects','Sound effects')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'sound_effects', label_text = 'Sound effects';
        
DELETE FROM bom_translation WHERE guid='931e232ea7a5f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7a5f','ko','label_text','효과음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7ade','user','audio_narration','Audio narration')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'audio_narration', label_text = 'Audio narration';
        
DELETE FROM bom_translation WHERE guid='931e232ea7ade' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7ade','ko','label_text','음성','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7b5e','general','lang_code','en')
        ON DUPLICATE KEY UPDATE
         type = 'general', label_id = 'lang_code', label_text = 'en';
        
DELETE FROM bom_translation WHERE guid='931e232ea7b5e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7b5e','ko','label_text','ko','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7bdf','user','facsimiles','Facsimiles')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'facsimiles', label_text = 'Facsimiles';
        
DELETE FROM bom_translation WHERE guid='931e232ea7bdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7bdf','ko','label_text','사본','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7c5d','user','auto_play','Auto-play')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'auto_play', label_text = 'Auto-play';
        
DELETE FROM bom_translation WHERE guid='931e232ea7c5d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7c5d','ko','label_text','자동 재생','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7cdf','study_group','group_name','Study group name')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_name', label_text = 'Study group name';
        
DELETE FROM bom_translation WHERE guid='931e232ea7cdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7cdf','ko','label_text','그룹 명칭','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7d67','study_group','group_description','Study group description')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_description', label_text = 'Study group description';
        
DELETE FROM bom_translation WHERE guid='931e232ea7d67' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7d67','ko','label_text','그룹 설명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7dde','study_group','edit_group_profile','Edit group profile information')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'edit_group_profile', label_text = 'Edit group profile information';
        
DELETE FROM bom_translation WHERE guid='931e232ea7dde' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7dde','ko','label_text','정보 수정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7e64','study_group','manage_group_members','Manage group members')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'manage_group_members', label_text = 'Manage group members';
        
DELETE FROM bom_translation WHERE guid='931e232ea7e64' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7e64','ko','label_text','회원 관리','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7ede','study_group','remove_from_group','Remove from group')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'remove_from_group', label_text = 'Remove from group';
        
DELETE FROM bom_translation WHERE guid='931e232ea7ede' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7ede','ko','label_text','강제퇴장','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea7f74','study_group','ban_from_group','Ban from group')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'ban_from_group', label_text = 'Ban from group';
        
DELETE FROM bom_translation WHERE guid='931e232ea7f74' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea7f74','ko','label_text','차단','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea800a','study_group','mute','Mute')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'mute', label_text = 'Mute';
        
DELETE FROM bom_translation WHERE guid='931e232ea800a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea800a','ko','label_text','조용히','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea8094','study_group','make_group_admin','Make group admin')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'make_group_admin', label_text = 'Make group admin';
        
DELETE FROM bom_translation WHERE guid='931e232ea8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea8094','ko','label_text','관리자 권한 부여','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e223ja8094','study_group','admin','Admin')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'admin', label_text = 'Admin';
        
DELETE FROM bom_translation WHERE guid='931e223ja8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e223ja8094','ko','label_text','관리','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232fa8094','study_group','administrator','Administrator')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'administrator', label_text = 'Administrator';
        
DELETE FROM bom_translation WHERE guid='931e232fa8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232fa8094','ko','label_text','관리자','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea8110','study_group','you_are_invited','You are invited to join this study group:')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'you_are_invited', label_text = 'You are invited to join this study group:';
        
DELETE FROM bom_translation WHERE guid='931e232ea8110' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea8110','ko','label_text','이 스터디 그룹에 초대되었습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea81a6','study_group','accept_invite','Accept Invitation')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'accept_invite', label_text = 'Accept Invitation';
        
DELETE FROM bom_translation WHERE guid='931e232ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea81a6','ko','label_text','수락','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea8222','study_group','decline_invite','Decline Invitation')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'decline_invite', label_text = 'Decline Invitation';
        
DELETE FROM bom_translation WHERE guid='931e232ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea8222','ko','label_text','거절','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea8299','study_group','group_load_failed','Group data failed to load')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_load_failed', label_text = 'Group data failed to load';
        
DELETE FROM bom_translation WHERE guid='931e232ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea8299','ko','label_text','그룹 데이터 로딩에 실패했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea8312','study_group','group_preview','Study group preview')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_preview', label_text = 'Study group preview';
        
DELETE FROM bom_translation WHERE guid='931e232ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea8312','ko','label_text','스터디 그룹 둘러보기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea838e','study_group','group_members','Study group members')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'group_members', label_text = 'Study group members';
        
DELETE FROM bom_translation WHERE guid='931e232ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea838e','ko','label_text','그룹 구성원','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('931e232ea840a','study_group','recent_convo','Recent discussion')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'recent_convo', label_text = 'Recent discussion';
        
DELETE FROM bom_translation WHERE guid='931e232ea840a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('931e232ea840a','ko','label_text','최근 대화','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea524f','study_group','study_groups_are','Study groups are a place for people to congregate and discuss their findings, insights, notes, and study progress.')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'study_groups_are', label_text = 'Study groups are a place for people to congregate and discuss their findings, insights, notes, and study progress.';
        
DELETE FROM bom_translation WHERE guid='743e232ea524f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea524f','ko','label_text','스터디 그룹은 사람들이 모여 자신들의 발견과 통찰, 노트 필기, 공부 진행 상황 등을 공유하고 토론하는 공간입니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea5344','study_group','create_or_join_groups','You are not part of any study groups.  Join or create a new one.')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'create_or_join_groups', label_text = 'You are not part of any study groups.  Join or create a new one.';
        
DELETE FROM bom_translation WHERE guid='743e232ea5344' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea5344','ko','label_text','속하신 스터디 그룹은 없습니다. 그룹을 가입하거나 새로운 그룹 만드십시오.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea5343','study_group','need_an_account','Need an account?')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'need_an_account', label_text = 'Need an account?';
        
DELETE FROM bom_translation WHERE guid='743e232ea5343' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea5343','ko','label_text','계정이 필요하나요?','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea54af','study_group','have_an_account','Have an account?')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'have_an_account', label_text = 'Have an account?';
        
DELETE FROM bom_translation WHERE guid='743e232ea54af' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea54af','ko','label_text','계정이 있나요?','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea54a1','study_group','account_required','User account required to continue')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'account_required', label_text = 'User account required to continue';
        
DELETE FROM bom_translation WHERE guid='743e232ea54a1' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea54a1','ko','label_text','계속하려면 사용자 계정이 필요합니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea554a','study_group','admin','Administration')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'admin', label_text = 'Administration';
        
DELETE FROM bom_translation WHERE guid='743e232ea554a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea554a','ko','label_text','관리','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea554b','study_group','x_is_writing','$1 is writing a comment...')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'x_is_writing', label_text = '$1 is writing a comment...';
        
DELETE FROM bom_translation WHERE guid='743e232ea554b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea554b','ko','label_text','$1님이 댓글을 쓰고 있어요...','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea563d','study_group','remove_admin','Revoke admin privileges')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'remove_admin', label_text = 'Revoke admin privileges';
        
DELETE FROM bom_translation WHERE guid='743e232ea563d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea563d','ko','label_text','관리자 권한 정지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea56b9','user','logging_in','Logging in...')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'logging_in', label_text = 'Logging in...';
        
DELETE FROM bom_translation WHERE guid='743e232ea56b9' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea56b9','ko','label_text','로그인중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea5c36','user','last_studied','Last studied')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'last_studied', label_text = 'Last studied';
        
DELETE FROM bom_translation WHERE guid='743e232ea5c36' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea5c36','ko','label_text','최근 학습','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea6f3e','user','currently_studying','Currently studying')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'currently_studying', label_text = 'Currently studying';
        
DELETE FROM bom_translation WHERE guid='743e232ea6f3e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea6f3e','ko','label_text','현재 학습 지점','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7140','user','send_dm','Send direct message')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'send_dm', label_text = 'Send direct message';
        
DELETE FROM bom_translation WHERE guid='743e232ea7140' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7140','ko','label_text','쪽지 보내기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea71bb','study_group','current_group','Present group')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'current_group', label_text = 'Present group';
        
DELETE FROM bom_translation WHERE guid='743e232ea71bb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea71bb','ko','label_text','현재 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7237','study_group','open_study_hall','Open study hall')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'open_study_hall', label_text = 'Open study hall';
        
DELETE FROM bom_translation WHERE guid='743e232ea7237' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7237','ko','label_text','학습실 열기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea72b3','study_group','start_call','Start a call')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'start_call', label_text = 'Start a call';
        
DELETE FROM bom_translation WHERE guid='743e232ea72b3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea72b3','ko','label_text','음성통화','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea732e','study_group','get_invite_link','Get sharable invite link')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'get_invite_link', label_text = 'Get sharable invite link';
        
DELETE FROM bom_translation WHERE guid='743e232ea732e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea732e','ko','label_text','초대 링크 공유','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea73aa','study_group','leave_group','Leave study group')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'leave_group', label_text = 'Leave study group';
        
DELETE FROM bom_translation WHERE guid='743e232ea73aa' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea73aa','ko','label_text','그룹 탈퇴','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea74af','study_group','loading_group_page_comments','Loading study group comments')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'loading_group_page_comments', label_text = 'Loading study group comments';
        
DELETE FROM bom_translation WHERE guid='743e232ea74af' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea74af','ko','label_text','스터디 그룹 댓글 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea752f','notes','commentary_on','Commentary on $1')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'commentary_on', label_text = 'Commentary on $1';
        
DELETE FROM bom_translation WHERE guid='743e232ea752f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea752f','ko','label_text','$1에 대한 해설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea70ac','study_group','x_comment_in_y','$1’s comment in $2')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'x_comment_in_y', label_text = '$1’s comment in $2';
        
DELETE FROM bom_translation WHERE guid='743e232ea70ac' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea70ac','ko','label_text','$1님이 $2에서 남긴 댓글','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea753b','notes','art_on_x','Illustration of $1')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'art_on_x', label_text = 'Illustration of $1';
        
DELETE FROM bom_translation WHERE guid='743e232ea753b' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea753b','ko','label_text','$1에 대한 이미지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea753a','notes','commentary_on_x_by_y','Commentary on $1 by $2')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'commentary_on_x_by_y', label_text = 'Commentary on $1 by $2';
        
DELETE FROM bom_translation WHERE guid='743e232ea753a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea753a','ko','label_text','$1에 대한 해설 • $2','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea75a6','notes','loading_commentary','Loading commentary...')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'loading_commentary', label_text = 'Loading commentary...';
        
DELETE FROM bom_translation WHERE guid='743e232ea75a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea75a6','ko','label_text','해설 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7627','notes','loading_x','Loading $1...')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'loading_x', label_text = 'Loading $1...';
        
DELETE FROM bom_translation WHERE guid='743e232ea7627' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7627','ko','label_text','$1 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea76a0','notes','commentary','commentary')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'commentary', label_text = 'commentary';
        
DELETE FROM bom_translation WHERE guid='743e232ea76a0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea76a0','ko','label_text','해설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7736','notes','person','person')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'person', label_text = 'person';
        
DELETE FROM bom_translation WHERE guid='743e232ea7736' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7736','ko','label_text','인물','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea77cc','notes','place','place')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'place', label_text = 'place';
        
DELETE FROM bom_translation WHERE guid='743e232ea77cc' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea77cc','ko','label_text','장소','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea77cd','notes','facsimile_of_x','Facsimile of $1')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'facsimile_of_x', label_text = 'Facsimile of $1';
        
DELETE FROM bom_translation WHERE guid='743e232ea77cd' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea77cd','ko','label_text','$1의 사본 스캔','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7862','study','say_something','Say something...')
        ON DUPLICATE KEY UPDATE
         type = 'study', label_id = 'say_something', label_text = 'Say something...';
        
DELETE FROM bom_translation WHERE guid='743e232ea7862' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7862','ko','label_text','댓글을 입력하세요...','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea78eb','study_group','go_to_last_msg','Go to latest message')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'go_to_last_msg', label_text = 'Go to latest message';
        
DELETE FROM bom_translation WHERE guid='743e232ea78eb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea78eb','ko','label_text','최근 메시지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7967','study_group','join_call','Join call')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'join_call', label_text = 'Join call';
        
DELETE FROM bom_translation WHERE guid='743e232ea7967' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7967','ko','label_text','음성 대화 참여','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea79e3','study_group','no_notifications','No notifications')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'no_notifications', label_text = 'No notifications';
        
DELETE FROM bom_translation WHERE guid='743e232ea79e3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea79e3','ko','label_text','알림 없음','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7a5f','study_group','loading_previous_messages','Loading previous messages')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'loading_previous_messages', label_text = 'Loading previous messages';
        
DELETE FROM bom_translation WHERE guid='743e232ea7a5f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7a5f','ko','label_text','이전 메시지 로딩','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7ade','study_group','dms_with_x','Direct messages with $1')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'dms_with_x', label_text = 'Direct messages with $1';
        
DELETE FROM bom_translation WHERE guid='743e232ea7ade' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7ade','ko','label_text','$1님과의 비공개 대화','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7b5e','study_group','study_groups','Study groups')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'study_groups', label_text = 'Study groups';
        
DELETE FROM bom_translation WHERE guid='743e232ea7b5e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7b5e','ko','label_text','스터디 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7bdf','study_group','invitation_not_found','Invitation not found')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'invitation_not_found', label_text = 'Invitation not found';
        
DELETE FROM bom_translation WHERE guid='743e232ea7bdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7bdf','ko','label_text','초대를 찾을 수 없습니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232123456','study_group','x_member','$1 member')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'x_member', label_text = '$1 member';
        
DELETE FROM bom_translation WHERE guid='743e232123456' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232123456','ko','label_text','$1명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232123455','study_group','x_members','$1 members')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'x_members', label_text = '$1 members';
        
DELETE FROM bom_translation WHERE guid='743e232123455' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232123455','ko','label_text','$1명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7c5d','user','user_profile','User profile')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'user_profile', label_text = 'User profile';
        
DELETE FROM bom_translation WHERE guid='743e232ea7c5d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7c5d','ko','label_text','사용자 프로필','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7cdf','user','login_for_history','Sign-up for an account to see your study history')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'login_for_history', label_text = 'Sign-up for an account to see your study history';
        
DELETE FROM bom_translation WHERE guid='743e232ea7cdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7cdf','ko','label_text','스터디 기록을 보려면 계정에 등록하십시오.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7d67','user','x_came_online','$1 is here')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'x_came_online', label_text = '$1 is here';
        
DELETE FROM bom_translation WHERE guid='743e232ea7d67' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7d67','ko','label_text','$1님이 등장했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7dde','user','x_went_offline','$1 went away')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'x_went_offline', label_text = '$1 went away';
        
DELETE FROM bom_translation WHERE guid='743e232ea7dde' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7dde','ko','label_text','$1님이 가버렸습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7e64','user','x_switched_groups','$1 is studying elsewhere')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'x_switched_groups', label_text = '$1 is studying elsewhere';
        
DELETE FROM bom_translation WHERE guid='743e232ea7e64' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7e64','ko','label_text','$1님이 다른 학습실에 들어갔습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7ede','user','x_joined_a_call','$1 joined a call')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'x_joined_a_call', label_text = '$1 joined a call';
        
DELETE FROM bom_translation WHERE guid='743e232ea7ede' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7ede','ko','label_text','$1님이 통화에 들어갔습니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea7f74','notes','loading_publications','Loading publications...')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'loading_publications', label_text = 'Loading publications...';
        
DELETE FROM bom_translation WHERE guid='743e232ea7f74' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea7f74','ko','label_text','출판물 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea800a','notes','commentary','Commentary')
        ON DUPLICATE KEY UPDATE
         type = 'notes', label_id = 'commentary', label_text = 'Commentary';
        
DELETE FROM bom_translation WHERE guid='743e232ea800a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea800a','ko','label_text','해설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea8094','user','direct_messages','Direct messages')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'direct_messages', label_text = 'Direct messages';
        
DELETE FROM bom_translation WHERE guid='743e232ea8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea8094','ko','label_text','쪽지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea8110','user','direct_message','Direct message')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'direct_message', label_text = 'Direct message';
        
DELETE FROM bom_translation WHERE guid='743e232ea8110' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea8110','ko','label_text','쪽지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea81a6','study_group','accept_inviting','Accepting invitation')
        ON DUPLICATE KEY UPDATE
         type = 'study_group', label_id = 'accept_inviting', label_text = 'Accepting invitation';
        
DELETE FROM bom_translation WHERE guid='743e232ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea81a6','ko','label_text','초대 수락중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea8222','user','could_not_change_password','Failed to change password')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'could_not_change_password', label_text = 'Failed to change password';
        
DELETE FROM bom_translation WHERE guid='743e232ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea8222','ko','label_text','비번 변경 실패','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea8299','user','new_password_saved','New password saved')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'new_password_saved', label_text = 'New password saved';
        
DELETE FROM bom_translation WHERE guid='743e232ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea8299','ko','label_text','비번 변경되었습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea8312','user','password_no_match','Passwords do not match')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'password_no_match', label_text = 'Passwords do not match';
        
DELETE FROM bom_translation WHERE guid='743e232ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea8312','ko','label_text','암호가 일치하지 않습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232fa8313','user','day_month','ddd, D MMM')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'day_month', label_text = 'ddd, D MMM';
        
DELETE FROM bom_translation WHERE guid='743e232fa8313' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232fa8313','ko','label_text','YYYY년 M월 D일','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ed8312','user','intl_date','YYYY-MM-DD')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'intl_date', label_text = 'YYYY-MM-DD';
        
DELETE FROM bom_translation WHERE guid='743e232ed8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ed8312','ko','label_text','YYYY년 M월 D일','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea8874','user','full_datetime','ddd, D MMM YYYY h:mm A')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'full_datetime', label_text = 'ddd, D MMM YYYY h:mm A';
        
DELETE FROM bom_translation WHERE guid='743e232ea8874' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea8874','ko','label_text','YYYY년 M월 D일 h:mm A','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea838e','user','history_date_format_full','D MMM YYYY')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'history_date_format_full', label_text = 'D MMM YYYY';
        
DELETE FROM bom_translation WHERE guid='743e232ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea838e','ko','label_text','YYYY년 M월 D일','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea836s','user','duration_format','h [hrs] mm [mins]')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'duration_format', label_text = 'h [hrs] mm [mins]';
        
DELETE FROM bom_translation WHERE guid='743e232ea836s' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea836s','ko','label_text','h[시간] m[분]','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea840a','user','history_date_format_year','YYYY')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'history_date_format_year', label_text = 'YYYY';
        
DELETE FROM bom_translation WHERE guid='743e232ea840a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea840a','ko','label_text','YYYY년','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea840x','user','history_date_format_month','MMM YYYY')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'history_date_format_month', label_text = 'MMM YYYY';
        
DELETE FROM bom_translation WHERE guid='743e232ea840x' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea840x','ko','label_text','YYYY년 M월','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232xa840x','user','time_format','h:mm A')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'time_format', label_text = 'h:mm A';
        
DELETE FROM bom_translation WHERE guid='743e232xa840x' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232xa840x','ko','label_text','A h[시] mm[분]','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea840y','user','year_format','$1')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'year_format', label_text = '$1';
        
DELETE FROM bom_translation WHERE guid='743e232ea840y' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea840y','ko','label_text','$1년','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e232ea840z','user','could_not_login','Could not login')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'could_not_login', label_text = 'Could not login';
        
DELETE FROM bom_translation WHERE guid='743e232ea840z' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e232ea840z','ko','label_text','록인 실페','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea752f','user','current_bookmark','Current Bookmark')
        ON DUPLICATE KEY UPDATE
         type = 'user', label_id = 'current_bookmark', label_text = 'Current Bookmark';
        
DELETE FROM bom_translation WHERE guid='743e963ea752f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea752f','ko','label_text','책갈피','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea75a6','home','community','Community')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'community', label_text = 'Community';
        
DELETE FROM bom_translation WHERE guid='743e963ea75a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea75a6','ko','label_text','커뮤니티','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7627','home','my_groups','My Groups')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'my_groups', label_text = 'My Groups';
        
DELETE FROM bom_translation WHERE guid='743e963ea7627' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7627','ko','label_text','내가 속한 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea76a0','home','group_i_follow','Groups I Follow')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'group_i_follow', label_text = 'Groups I Follow';
        
DELETE FROM bom_translation WHERE guid='743e963ea76a0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea76a0','ko','label_text','내가 팔로우하는 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7736','home','featured_groups','Featured Groups')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'featured_groups', label_text = 'Featured Groups';
        
DELETE FROM bom_translation WHERE guid='743e963ea7736' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7736','ko','label_text','추천 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea77cc','prefs','controversial_commentaries','Controversial Commentaries')
        ON DUPLICATE KEY UPDATE
         type = 'prefs', label_id = 'controversial_commentaries', label_text = 'Controversial Commentaries';
        
DELETE FROM bom_translation WHERE guid='743e963ea77cc' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea77cc','ko','label_text','논쟁의 여지가 있는 해설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7862','home','see_more','See more...')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'see_more', label_text = 'See more...';
        
DELETE FROM bom_translation WHERE guid='743e963ea7862' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7862','ko','label_text','더 보기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea78eb','home','join','Join')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'join', label_text = 'Join';
        
DELETE FROM bom_translation WHERE guid='743e963ea78eb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea78eb','ko','label_text','가입','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7967','home','request','Apply')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'request', label_text = 'Apply';
        
DELETE FROM bom_translation WHERE guid='743e963ea7967' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7967','ko','label_text','신청','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea79e3','home','study','Study')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'study', label_text = 'Study';
        
DELETE FROM bom_translation WHERE guid='743e963ea79e3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea79e3','ko','label_text','열기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7a5f','home','mine_groupd','My Groups')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'mine_groupd', label_text = 'My Groups';
        
DELETE FROM bom_translation WHERE guid='743e963ea7a5f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7a5f','ko','label_text','내 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7ade','home','featured_groups','Featured Groups')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'featured_groups', label_text = 'Featured Groups';
        
DELETE FROM bom_translation WHERE guid='743e963ea7ade' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7ade','ko','label_text','공개 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7b5e','home','comment_count_plural','$1 comments')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'comment_count_plural', label_text = '$1 comments';
        
DELETE FROM bom_translation WHERE guid='743e963ea7b5e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7b5e','ko','label_text','댓글 $1개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7bdf','home','comment_count_singular','$1 comment')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'comment_count_singular', label_text = '$1 comment';
        
DELETE FROM bom_translation WHERE guid='743e963ea7bdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7bdf','ko','label_text','댓글 $1개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7c5d','home','loading_comments','Loading comments')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'loading_comments', label_text = 'Loading comments';
        
DELETE FROM bom_translation WHERE guid='743e963ea7c5d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7c5d','ko','label_text','댓글 로딩중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7cdf','home','like','Like')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'like', label_text = 'Like';
        
DELETE FROM bom_translation WHERE guid='743e963ea7cdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7cdf','ko','label_text','좋아요','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ev7cdf','home','liked','Liked')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'liked', label_text = 'Liked';
        
DELETE FROM bom_translation WHERE guid='743e963ev7cdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ev7cdf','ko','label_text','좋아요','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7d67','home','and_x_others','and $1 others')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'and_x_others', label_text = 'and $1 others';
        
DELETE FROM bom_translation WHERE guid='743e963ea7d67' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7d67','ko','label_text','외 $1명','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7dde','home','like_this_singular','likes this')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'like_this_singular', label_text = 'likes this';
        
DELETE FROM bom_translation WHERE guid='743e963ea7dde' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7dde','ko','label_text','좋아합니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7e64','home','like_this_plural','like this')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'like_this_plural', label_text = 'like this';
        
DELETE FROM bom_translation WHERE guid='743e963ea7e64' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7e64','ko','label_text','좋아합니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea7f74','home','join_to_comment','Join this group to comment')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'join_to_comment', label_text = 'Join this group to comment';
        
DELETE FROM bom_translation WHERE guid='743e963ea7f74' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea7f74','ko','label_text','가입 필수','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea800a','home','join_group','Join group')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'join_group', label_text = 'Join group';
        
DELETE FROM bom_translation WHERE guid='743e963ea800a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea800a','ko','label_text','가입 필수','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea8094','home','apply_for_membership','Apply for membership')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'apply_for_membership', label_text = 'Apply for membership';
        
DELETE FROM bom_translation WHERE guid='743e963ea8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea8094','ko','label_text','회원 가입 요청','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea8110','home','highlighted_text','highlighted a passage')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'highlighted_text', label_text = 'highlighted a passage';
        
DELETE FROM bom_translation WHERE guid='743e963ea8110' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea8110','ko','label_text','구절 일부를 표시했습니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea81a6','home','commented_text','commented on a passage')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'commented_text', label_text = 'commented on a passage';
        
DELETE FROM bom_translation WHERE guid='743e963ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea81a6','ko','label_text','구절에 댓글을 남겼습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea8222','home','highlighted_img','highlighted a image')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'highlighted_img', label_text = 'highlighted a image';
        
DELETE FROM bom_translation WHERE guid='743e963ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea8222','ko','label_text','이미지를 표시했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea8299','home','commented_img','commented on a image')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'commented_img', label_text = 'commented on a image';
        
DELETE FROM bom_translation WHERE guid='743e963ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea8299','ko','label_text','이미지에 댓글을 남겼습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea8312','home','highlighted_fax','highlighted a facsimile')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'highlighted_fax', label_text = 'highlighted a facsimile';
        
DELETE FROM bom_translation WHERE guid='743e963ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea8312','ko','label_text','사본 스캔을 표시했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea838e','home','commented_fax','commented on a facsimile')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'commented_fax', label_text = 'commented on a facsimile';
        
DELETE FROM bom_translation WHERE guid='743e963ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea838e','ko','label_text','사본 스캔에 댓글을 남겼습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea840y','home','highlighted_section','highlighted on a section')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'highlighted_section', label_text = 'highlighted on a section';
        
DELETE FROM bom_translation WHERE guid='743e963ea840y' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea840y','ko','label_text','구간을 표시했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743e963ea840z','home','commented_section','commented on a section')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'commented_section', label_text = 'commented on a section';
        
DELETE FROM bom_translation WHERE guid='743e963ea840z' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743e963ea840z','ko','label_text','구간에  댓글을 남겼습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('843e963ea840y','home','highlighted_com','highlighted some commentary')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'highlighted_com', label_text = 'highlighted some commentary';
        
DELETE FROM bom_translation WHERE guid='843e963ea840y' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('843e963ea840y','ko','label_text','해설을 표시했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('843e963ea840z','home','commented_com','commented on some commentary')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'commented_com', label_text = 'commented on some commentary';
        
DELETE FROM bom_translation WHERE guid='843e963ea840z' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('843e963ea840z','ko','label_text','해설에  댓글을 남겼습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('843e963ea840x','home','posted_comment','posted a comment')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'posted_comment', label_text = 'posted a comment';
        
DELETE FROM bom_translation WHERE guid='843e963ea840x' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('843e963ea840x','ko','label_text','댓글을 남겼습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea752f','home','private_group','Private Group')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'private_group', label_text = 'Private Group';
        
DELETE FROM bom_translation WHERE guid='743f836ea752f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea752f','ko','label_text','비공개 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea75a6','home','public_group','Public Group')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'public_group', label_text = 'Public Group';
        
DELETE FROM bom_translation WHERE guid='743f836ea75a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea75a6','ko','label_text','공개 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7627','home','open_group','Open Group')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'open_group', label_text = 'Open Group';
        
DELETE FROM bom_translation WHERE guid='743f836ea7627' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7627','ko','label_text','오픈 그룹','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea76a0','home','honorific','')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'honorific', label_text = '';
        
DELETE FROM bom_translation WHERE guid='743f836ea76a0' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea76a0','ko','label_text','님','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea76a1','home','honorific_subject','')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'honorific_subject', label_text = '';
        
DELETE FROM bom_translation WHERE guid='743f836ea76a1' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea76a1','ko','label_text','이','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7736','time','moment_locale','en')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_locale', label_text = 'en';
        
DELETE FROM bom_translation WHERE guid='743f836ea7736' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7736','ko','label_text','ko','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea77cc','time','moment_future','just now')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_future', label_text = 'just now';
        
DELETE FROM bom_translation WHERE guid='743f836ea77cc' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea77cc','ko','label_text','방금전','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7862','time','moment_past','%s ago')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_past', label_text = '%s ago';
        
DELETE FROM bom_translation WHERE guid='743f836ea7862' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7862','ko','label_text','%s 전','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea78eb','time','moment_s','seconds')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_s', label_text = 'seconds';
        
DELETE FROM bom_translation WHERE guid='743f836ea78eb' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea78eb','ko','label_text','초','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7967','time','moment_ss','%ss')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_ss', label_text = '%ss';
        
DELETE FROM bom_translation WHERE guid='743f836ea7967' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7967','ko','label_text','%s처','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea79e3','time','moment_m','1min')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_m', label_text = '1min';
        
DELETE FROM bom_translation WHERE guid='743f836ea79e3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea79e3','ko','label_text','1분','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7a5f','time','moment_mm','%dm')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_mm', label_text = '%dm';
        
DELETE FROM bom_translation WHERE guid='743f836ea7a5f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7a5f','ko','label_text','%d분','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7ade','time','moment_h','1hr')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_h', label_text = '1hr';
        
DELETE FROM bom_translation WHERE guid='743f836ea7ade' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7ade','ko','label_text','1시간','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7b5e','time','moment_hh','%dh')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_hh', label_text = '%dh';
        
DELETE FROM bom_translation WHERE guid='743f836ea7b5e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7b5e','ko','label_text','%d시간','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7bdf','time','moment_d','1d')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_d', label_text = '1d';
        
DELETE FROM bom_translation WHERE guid='743f836ea7bdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7bdf','ko','label_text','1일','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7c5d','time','moment_dd','%dd')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_dd', label_text = '%dd';
        
DELETE FROM bom_translation WHERE guid='743f836ea7c5d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7c5d','ko','label_text','%d일','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7cdf','time','moment_M','1m')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_M', label_text = '1m';
        
DELETE FROM bom_translation WHERE guid='743f836ea7cdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7cdf','ko','label_text','1달','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7d67','time','moment_MM','%dM')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_MM', label_text = '%dM';
        
DELETE FROM bom_translation WHERE guid='743f836ea7d67' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7d67','ko','label_text','%d달','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7dde','time','moment_y','1y')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_y', label_text = '1y';
        
DELETE FROM bom_translation WHERE guid='743f836ea7dde' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7dde','ko','label_text','1년','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7e64','time','moment_yy','%dY')
        ON DUPLICATE KEY UPDATE
         type = 'time', label_id = 'moment_yy', label_text = '%dY';
        
DELETE FROM bom_translation WHERE guid='743f836ea7e64' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7e64','ko','label_text','%d년','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7ede','home','and','and')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'and', label_text = 'and';
        
DELETE FROM bom_translation WHERE guid='743f836ea7ede' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7ede','ko','label_text','그리고','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea7f74','home','open_studyhall','Open study hall')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'open_studyhall', label_text = 'Open study hall';
        
DELETE FROM bom_translation WHERE guid='743f836ea7f74' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea7f74','ko','label_text','학습실 바로가기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea800a','home','request_admission','Request admission')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'request_admission', label_text = 'Request admission';
        
DELETE FROM bom_translation WHERE guid='743f836ea800a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea800a','ko','label_text','수락요청','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea8094','home','join_instantly','Join instantly')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'join_instantly', label_text = 'Join instantly';
        
DELETE FROM bom_translation WHERE guid='743f836ea8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea8094','ko','label_text','즉시 가입','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea8110','home','joining','Joining...')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'joining', label_text = 'Joining...';
        
DELETE FROM bom_translation WHERE guid='743f836ea8110' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea8110','ko','label_text','가입 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea81a6','home','joined','Joined')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'joined', label_text = 'Joined';
        
DELETE FROM bom_translation WHERE guid='743f836ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea81a6','ko','label_text','가입완료','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea8222','home','applying','Applying')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'applying', label_text = 'Applying';
        
DELETE FROM bom_translation WHERE guid='743f836ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea8222','ko','label_text','신청 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea8299','home','applied','Applied')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'applied', label_text = 'Applied';
        
DELETE FROM bom_translation WHERE guid='743f836ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea8299','ko','label_text','신청완료','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea8312','home','join_failed','Failed to join')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'join_failed', label_text = 'Failed to join';
        
DELETE FROM bom_translation WHERE guid='743f836ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea8312','ko','label_text','가입실패','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea838e','home','application_recieved','Application received')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'application_recieved', label_text = 'Application received';
        
DELETE FROM bom_translation WHERE guid='743f836ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea838e','ko','label_text','수락요청 완료','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('743f836ea840y','home','withdrawing','Withdrawing')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'withdrawing', label_text = 'Withdrawing';
        
DELETE FROM bom_translation WHERE guid='743f836ea840y' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('743f836ea840y','ko','label_text','철회 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea79e3','home','application_withdrawn','Application withdrawn')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'application_withdrawn', label_text = 'Application withdrawn';
        
DELETE FROM bom_translation WHERE guid='748f836ea79e3' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea79e3','ko','label_text','철회완료','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7a5f','home','withdraw_failed','Failed to withdraw')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'withdraw_failed', label_text = 'Failed to withdraw';
        
DELETE FROM bom_translation WHERE guid='748f836ea7a5f' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7a5f','ko','label_text','철회실패','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7ade','home','apply','Apply')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'apply', label_text = 'Apply';
        
DELETE FROM bom_translation WHERE guid='748f836ea7ade' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7ade','ko','label_text','신청','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7b5e','home','x_memebership_requests','$1 membership requests')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'x_memebership_requests', label_text = '$1 membership requests';
        
DELETE FROM bom_translation WHERE guid='748f836ea7b5e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7b5e','ko','label_text','수락요청 $1개','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7bdf','home','approve','Approve')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'approve', label_text = 'Approve';
        
DELETE FROM bom_translation WHERE guid='748f836ea7bdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7bdf','ko','label_text','승인','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7c5d','home','deny','Deny')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'deny', label_text = 'Deny';
        
DELETE FROM bom_translation WHERE guid='748f836ea7c5d' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7c5d','ko','label_text','거절','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7cdf','home','approving','Approving')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'approving', label_text = 'Approving';
        
DELETE FROM bom_translation WHERE guid='748f836ea7cdf' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7cdf','ko','label_text','승인 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7d67','home','denying','Denying')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'denying', label_text = 'Denying';
        
DELETE FROM bom_translation WHERE guid='748f836ea7d67' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7d67','ko','label_text','거절 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7dde','supplement','location_profile','Location Profile')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'location_profile', label_text = 'Location Profile';
        
DELETE FROM bom_translation WHERE guid='748f836ea7dde' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7dde','ko','label_text','장소 프로필','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7e64','supplement','commentary_on_x','Commentary on $1')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'commentary_on_x', label_text = 'Commentary on $1';
        
DELETE FROM bom_translation WHERE guid='748f836ea7e64' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7e64','ko','label_text','$1에대한 해설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7ede','supplement','person_profile','People Profile')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'person_profile', label_text = 'People Profile';
        
DELETE FROM bom_translation WHERE guid='748f836ea7ede' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7ede','ko','label_text','인물 프로필','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea7f74','supplement','relationships','Relationships')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'relationships', label_text = 'Relationships';
        
DELETE FROM bom_translation WHERE guid='748f836ea7f74' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea7f74','ko','label_text','관계','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea800a','supplement','references','References')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'references', label_text = 'References';
        
DELETE FROM bom_translation WHERE guid='748f836ea800a' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea800a','ko','label_text','언급구절','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea8094','supplement','view_on_map','View on Map')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'view_on_map', label_text = 'View on Map';
        
DELETE FROM bom_translation WHERE guid='748f836ea8094' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea8094','ko','label_text','지도에 보기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea8095','supplement','bom_maps','Maps and Geography Models')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'bom_maps', label_text = 'Maps and Geography Models';
        
DELETE FROM bom_translation WHERE guid='748f836ea8095' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea8095','ko','label_text','지도 및 지리적 가설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea8096','supplement','geo_model','$1 geography model')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'geo_model', label_text = '$1 geography model';
        
DELETE FROM bom_translation WHERE guid='748f836ea8096' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea8096','ko','label_text','$1 가설','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea8110','supplement','saving','Saving...')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'saving', label_text = 'Saving...';
        
DELETE FROM bom_translation WHERE guid='748f836ea8110' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea8110','ko','label_text','저장 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea81a6','supplement','highlighting','Highlighting...')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'highlighting', label_text = 'Highlighting...';
        
DELETE FROM bom_translation WHERE guid='748f836ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea81a6','ko','label_text','표시 중','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea8222','supplement','x_added_y_highlight','$1 highlighted some text.')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'x_added_y_highlight', label_text = '$1 highlighted some text.';
        
DELETE FROM bom_translation WHERE guid='748f836ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea8222','ko','label_text','$1님이 글을 표시했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea8299','supplement','x_added_y_highlights','$1 added $2 highlights.')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'x_added_y_highlights', label_text = '$1 added $2 highlights.';
        
DELETE FROM bom_translation WHERE guid='748f836ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea8299','ko','label_text','$1님이 표시를 $2개 추가했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea8312','supplement','x_highlighted_image','$1 highlighted an image.')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'x_highlighted_image', label_text = '$1 highlighted an image.';
        
DELETE FROM bom_translation WHERE guid='748f836ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea8312','ko','label_text','$1님이 이미지를 표시했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea838e','supplement','x_highlighted_facsimile','$1 highlighted a facsimile.')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'x_highlighted_facsimile', label_text = '$1 highlighted a facsimile.';
        
DELETE FROM bom_translation WHERE guid='748f836ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea838e','ko','label_text','$1님이 사본 스캔을 표시했습니다','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea840y','supplement','legal_notice','Legal notice')
        ON DUPLICATE KEY UPDATE
         type = 'supplement', label_id = 'legal_notice', label_text = 'Legal notice';
        
DELETE FROM bom_translation WHERE guid='748f836ea840y' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea840y','ko','label_text','법률적고지','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('748f836ea840z','community','invite_link','Share Invitation Link')
        ON DUPLICATE KEY UPDATE
         type = 'community', label_id = 'invite_link', label_text = 'Share Invitation Link';
        
DELETE FROM bom_translation WHERE guid='748f836ea840z' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('748f836ea840z','ko','label_text','공유 링크','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f836ea8110','upload','upload_photo','Upload image')
        ON DUPLICATE KEY UPDATE
         type = 'upload', label_id = 'upload_photo', label_text = 'Upload image';
        
DELETE FROM bom_translation WHERE guid='697f836ea8110' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f836ea8110','ko','label_text','이미지 업로드','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f836ea81a6','upload','edit_image','Edit image')
        ON DUPLICATE KEY UPDATE
         type = 'upload', label_id = 'edit_image', label_text = 'Edit image';
        
DELETE FROM bom_translation WHERE guid='697f836ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f836ea81a6','ko','label_text','이미지 수정','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f836ea8222','upload','select_image','Select image')
        ON DUPLICATE KEY UPDATE
         type = 'upload', label_id = 'select_image', label_text = 'Select image';
        
DELETE FROM bom_translation WHERE guid='697f836ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f836ea8222','ko','label_text','이미지 선택','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f836ea8299','upload','select_paste_drop_image','Select, drop, or paste image')
        ON DUPLICATE KEY UPDATE
         type = 'upload', label_id = 'select_paste_drop_image', label_text = 'Select, drop, or paste image';
        
DELETE FROM bom_translation WHERE guid='697f836ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f836ea8299','ko','label_text','이미지 선택, 삭제 또는 붙여넣기','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f836ea8312','upload','img_limits','A user’s profile image can be a JPG (.jpg), JPEG (.jpeg), or PNG (.png) file of up to 25 MB.')
        ON DUPLICATE KEY UPDATE
         type = 'upload', label_id = 'img_limits', label_text = 'A user’s profile image can be a JPG (.jpg), JPEG (.jpeg), or PNG (.png) file of up to 25 MB.';
        
DELETE FROM bom_translation WHERE guid='697f836ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f836ea8312','ko','label_text','프로필 이미지는 최대 25MB의 JPG(.jpg), JPEG(.jpeg) 또는 PNG(.png) 파일일 수 있습니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f836ea838e','home','highlight_msg','Highlighted content')
        ON DUPLICATE KEY UPDATE
         type = 'home', label_id = 'highlight_msg', label_text = 'Highlighted content';
        
DELETE FROM bom_translation WHERE guid='697f836ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f836ea838e','ko','label_text','강조 표시된 내용','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971ea81a6','victory','victory_congrats','Congratulations!')
        ON DUPLICATE KEY UPDATE
         type = 'victory', label_id = 'victory_congrats', label_text = 'Congratulations!';
        
DELETE FROM bom_translation WHERE guid='697f971ea81a6' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971ea81a6','ko','label_text','축하합니다!','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971ea8222','victory','victory_completed','You have completed 100% of the Book of Mormon.')
        ON DUPLICATE KEY UPDATE
         type = 'victory', label_id = 'victory_completed', label_text = 'You have completed 100% of the Book of Mormon.';
        
DELETE FROM bom_translation WHERE guid='697f971ea8222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971ea8222','ko','label_text','몰몬경을 처음부터 끝까지 읽으셨습니다!','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971ea8299','victory','victory_started_x','You started on $1')
        ON DUPLICATE KEY UPDATE
         type = 'victory', label_id = 'victory_started_x', label_text = 'You started on $1';
        
DELETE FROM bom_translation WHERE guid='697f971ea8299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971ea8299','ko','label_text','$1에 시작하셨습니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971ea8312','victory','victory_duration_x','It took you $1')
        ON DUPLICATE KEY UPDATE
         type = 'victory', label_id = 'victory_duration_x', label_text = 'It took you $1';
        
DELETE FROM bom_translation WHERE guid='697f971ea8312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971ea8312','ko','label_text','$1 걸렸어요','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971ea838e','victory','victory_sessions_x','It took you $1 sessions')
        ON DUPLICATE KEY UPDATE
         type = 'victory', label_id = 'victory_sessions_x', label_text = 'It took you $1 sessions';
        
DELETE FROM bom_translation WHERE guid='697f971ea838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971ea838e','ko','label_text','$1번의 학습 시간을 가지셨습니다.','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971f48222','seo','from_page','From page')
        ON DUPLICATE KEY UPDATE
         type = 'seo', label_id = 'from_page', label_text = 'From page';
        
DELETE FROM bom_translation WHERE guid='697f971f48222' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971f48222','ko','label_text','제목','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971f48299','seo','from_section','From section')
        ON DUPLICATE KEY UPDATE
         type = 'seo', label_id = 'from_section', label_text = 'From section';
        
DELETE FROM bom_translation WHERE guid='697f971f48299' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971f48299','ko','label_text','소제목','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971f48312','seo','previous','Previous')
        ON DUPLICATE KEY UPDATE
         type = 'seo', label_id = 'previous', label_text = 'Previous';
        
DELETE FROM bom_translation WHERE guid='697f971f48312' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971f48312','ko','label_text','이전','kcsql');
        
INSERT INTO bom_label (`guid`, `type`, `label_id`, `label_text`)
        VALUES
            ('697f971f4838e','seo','next','Next')
        ON DUPLICATE KEY UPDATE
         type = 'seo', label_id = 'next', label_text = 'Next';
        
DELETE FROM bom_translation WHERE guid='697f971f4838e' AND lang = 'ko';
            INSERT INTO bom_translation 
            ( `guid`, `lang`, `refkey`, `value`, `contributor`) 
            VALUES ('697f971f4838e','ko','label_text','다음','kcsql');
        