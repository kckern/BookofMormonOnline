
import {schedulePost} from "./post.mjs";
const postdata = [
    {
      "seq": "915",
      "time": "2022-03-29T17:05:19.000Z",
      "content": "To what cause of salvation does Alma first refer? Why is that particular cause so important? What does it mean to him? To us? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/7"
    },
    {
      "seq": "912",
      "time": "2022-03-29T23:56:45.000Z",
      "content": "To whom is the address in chapter 5 given? How is it particularly relevant to their situation? To whom is the sermon in chapter 7 given? How is it particularly relevant to their situation? https://bookofmormon.online/reign-of-judges/50"
    },
    {
      "seq": "119",
      "time": "2022-03-30T06:48:10.000Z",
      "content": "Verses 14 and 15 tell us that there was more than one bow among them. Why, then, when Nephi broke his bow the result was that they had no food (verse 18)? (See also verse 21—why does Nephi wait to answer that question for us?) https://bookofmormon.online/lehites/116"
    },
    {
      "seq": "1031",
      "time": "2022-03-30T13:39:36.000Z",
      "content": "What is the thing that Ammon desires of Lamoni and that Lamoni is bound to give Ammon, given what Lamoni said in verse 21? https://bookofmormon.online/ammon/40"
    },
    {
      "seq": "270",
      "time": "2022-03-30T20:31:02.000Z",
      "content": "To what time is the Lord referring when he says, “When I came, there was no man”? https://bookofmormon.online/jacobs-sermon/9"
    },
    {
      "seq": "832",
      "time": "2022-03-31T03:22:27.000Z",
      "content": "Why is the covenant sandwiched between the descriptions of Alma as a servant? What does the arrangement tell us? https://bookofmormon.online/zarahemla/59"
    },
    {
      "seq": "950",
      "time": "2022-03-31T10:13:53.000Z",
      "content": "This verse commands the Gideonites to be baptized not only so they may be washed of their sins, but also so they may have faith in Christ. How does baptism make faith in Christ possible? https://bookofmormon.online/reign-of-judges/gideon/10"
    },
    {
      "seq": "284",
      "time": "2022-03-31T17:05:19.000Z",
      "content": "Why do those who are righteous need not fear the reproach of others? https://bookofmormon.online/jacobs-sermon/14"
    },
    {
      "seq": "242",
      "time": "2022-03-31T23:56:45.000Z",
      "content": "What is Nephi’s answer to the troubles he has—to his weakness in the face of temptation, for example? https://bookofmormon.online/promised-land/48"
    },
    {
      "seq": "1428",
      "time": "2022-04-01T06:48:10.000Z",
      "content": "Notice that this behavior isn’t confined to the Anti-Nephi-Lehies. The other Lamanites appear to have taken up the same covenant, or at least to be motivated by the same fear. https://bookofmormon.online/samuel/44"
    },
    {
      "seq": "1596",
      "time": "2022-04-01T13:39:36.000Z",
      "content": "How could Moses think to have compared himself to Christ, especially by saying “Christ will be like me”? https://bookofmormon.online/jesus-teachings/10"
    },
    {
      "seq": "1157",
      "time": "2022-04-01T20:31:02.000Z",
      "content": "Is it significant that we will say, “Let us nourish it” (italics added)? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "584",
      "time": "2022-04-02T03:22:27.000Z",
      "content": "In the context of this verse, what does it mean to be saved? From what are we saved? https://bookofmormon.online/land-of-nephi/42"
    },
    {
      "seq": "1002",
      "time": "2022-04-02T10:13:53.000Z",
      "content": "Those who have this priesthood are to teach the Lord’s commandments. In what ways do they do that? What does it mean to enter into the Lord’s rest? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "11",
      "time": "2022-04-02T17:05:19.000Z",
      "content": "What is Nephi’s explanation for why he didn’t rebel against his father as his older brothers had done? https://bookofmormon.online/lehites/17"
    },
    {
      "seq": "1193",
      "time": "2022-04-02T23:56:45.000Z",
      "content": "Since Alma is here telling us about the pains he experienced, what can he mean when he says, “I could remember my pains no more”? https://bookofmormon.online/zarahemla/77"
    },
    {
      "seq": "898",
      "time": "2022-04-03T06:48:10.000Z",
      "content": "Why do you think ancient peoples felt it was important for a criminal given the death penalty not only to die but to suffer an ignominious death? https://bookofmormon.online/reign-of-judges/2"
    },
    {
      "seq": "139",
      "time": "2022-04-03T13:39:36.000Z",
      "content": "What does it mean to be “slow to remember the Lord”? Explain why that metaphor is appropriate. https://bookofmormon.online/lehites/153"
    },
    {
      "seq": "294",
      "time": "2022-04-03T20:31:02.000Z",
      "content": "In verse 17, what does the cup of the Lord’s fury or anger stand for? https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "1664",
      "time": "2022-04-04T03:22:27.000Z",
      "content": "What does it mean that the Nephites had all things in common? https://bookofmormon.online/mormon/69"
    },
    {
      "seq": "1294",
      "time": "2022-04-04T10:13:53.000Z",
      "content": "For what did the Nephites condemn Paanchi to death? Why was his crime so terrible that it deserved death? https://bookofmormon.online/war/144"
    },
    {
      "seq": "1287",
      "time": "2022-04-04T17:05:19.000Z",
      "content": "Given the actual reasons for Pahoran’s delay, what are we to make of what Moroni says about what the Lord has said? Does this tell us anything about the nature of revelation? https://bookofmormon.online/war/east/77"
    },
    {
      "seq": "1774",
      "time": "2022-04-04T23:56:45.000Z",
      "content": "When Ether says that all things are fulfilled by faith, what does he mean? What kinds of things can be fulfilled, and how are they fulfilled through faith? https://bookofmormon.online/jaredites/150"
    },
    {
      "seq": "1496",
      "time": "2022-04-05T06:48:10.000Z",
      "content": "Who are the meek? In verses 39–42, the Savior will give examples of meekness. Note, too, that this verse is a quotation of Psalm 37:11. Why would Jesus quote from the Old Testament so much in this explication of his gospel? https://bookofmormon.online/jesus/66"
    },
    {
      "seq": "1797",
      "time": "2022-04-05T13:39:36.000Z",
      "content": "The Lord tells Moroni he will be made strong because he has seen his weaknesses. Does that mean we must know our weaknesses if we are to be made strong? https://bookofmormon.online/moroni/79"
    },
    {
      "seq": "1124",
      "time": "2022-04-05T20:31:02.000Z",
      "content": "What does the word confound mean as it is used here? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/10"
    },
    {
      "seq": "1464",
      "time": "2022-04-06T03:22:27.000Z",
      "content": "What is the significance of saying that his own have rejected him? Is it significant in more than one way? https://bookofmormon.online/jesus/23"
    },
    {
      "seq": "1584",
      "time": "2022-04-06T10:13:53.000Z",
      "content": "What does it mean that “it was given unto them what they should pray”? Are our prayers ever like that? When? If not, should they be, or is this a special case of prayer? https://bookofmormon.online/jesus/161"
    },
    {
      "seq": "1555",
      "time": "2022-04-06T17:05:19.000Z",
      "content": "What does it mean to ponder something? What does it mean to ask the Father for understanding? https://bookofmormon.online/jesus/115"
    },
    {
      "seq": "320",
      "time": "2022-04-06T23:56:45.000Z",
      "content": "We sometimes speak as if the Atonement is required because there is a law that God must obey. Does Jacob speak that way? What does he say? Who has given the law? Whose justice is it that must be satisfied? https://bookofmormon.online/jacobs-sermon/31"
    },
    {
      "seq": "728",
      "time": "2022-04-07T06:48:10.000Z",
      "content": "How does this verse explain idolatry? How does idolatry result from flattery? https://bookofmormon.online/recolonization/25"
    },
    {
      "seq": "1070",
      "time": "2022-04-07T13:39:36.000Z",
      "content": "How do we avoid such sin? https://bookofmormon.online/reign-of-judges/87"
    },
    {
      "seq": "582",
      "time": "2022-04-07T20:31:02.000Z",
      "content": "Does “the power of his redemption” mean something different than “his redemption”? How do we partake of the power of his redemption? https://bookofmormon.online/land-of-nephi/42"
    },
    {
      "seq": "449",
      "time": "2022-04-08T03:22:27.000Z",
      "content": "Does the first part of verse 20 tell us that if we are to rely wholly on the merits of the Savior, then we must press forward in perfect hope and love? What does it mean to have perfect hope? Perfect love? https://bookofmormon.online/nephis-testimony/9"
    },
    {
      "seq": "276",
      "time": "2022-04-08T10:13:53.000Z",
      "content": "What does it mean that the righteous should look to the pit (or quarry) from which they were cut? https://bookofmormon.online/jacobs-sermon/12"
    },
    {
      "seq": "67",
      "time": "2022-04-08T17:05:19.000Z",
      "content": "When did the event of this verse occur? https://bookofmormon.online/lehites/nephis-vision/17"
    },
    {
      "seq": "164",
      "time": "2022-04-08T23:56:45.000Z",
      "content": "What will bind Satan, or prevent him from working, during the millennium? Does that suggest anything about our own relation to him? Is James 1:13–15 relevant? https://bookofmormon.online/promised-land/38"
    },
    {
      "seq": "439",
      "time": "2022-04-09T06:48:10.000Z",
      "content": "These verses begin and end with admonitions to follow Christ. What do they teach in between, and what has that to do with following Christ? https://bookofmormon.online/nephis-testimony/5"
    },
    {
      "seq": "383",
      "time": "2022-04-09T13:39:36.000Z",
      "content": "What does it mean that the law of Moses is dead to them? What does it mean that they keep the law though the law is dead to them? Is he teaching the same thing that Paul teaches in various places, such as Romans 3:20–24 (footnote b)? https://bookofmormon.online/nephis-teachings/12"
    },
    {
      "seq": "921",
      "time": "2022-04-09T20:31:02.000Z",
      "content": "How is Alma’s teaching related to the teaching of 1 John 3:2: “Beloved, now are we the sons of God, and it doth not yet appear what we shall be: but we know that, when he shall appear, we shall be like him; for we shall see him as he is”? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/9"
    },
    {
      "seq": "659",
      "time": "2022-04-10T03:22:27.000Z",
      "content": "Is Benjamin a “negative” person? https://bookofmormon.online/benjamin/70"
    },
    {
      "seq": "925",
      "time": "2022-04-10T10:13:53.000Z",
      "content": "What would it take for us to imagine that we hear God calling us blessed and calling us to him? If every person sins, what does it take for our works to be the works of righteousness? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/11"
    },
    {
      "seq": "1598",
      "time": "2022-04-10T17:05:19.000Z",
      "content": "Why is Moses such a central character in Israelite history, so central that time seems to have been reckoned around him—“before Moses” and “after Moses”—much as we measure time around Christ? https://bookofmormon.online/jesus-teachings/11"
    },
    {
      "seq": "118",
      "time": "2022-04-10T23:56:45.000Z",
      "content": "Why might Laman and Lemuel not complain at this departure, especially given its suddenness? What could anyone with the party have assumed from the fact that they were taking “seed of every kind” with them? https://bookofmormon.online/lehites/114"
    },
    {
      "seq": "41",
      "time": "2022-04-11T06:48:10.000Z",
      "content": "Here the Spirit asks the same question that he asked in verse 2. Why? Is there some sense in which this is the beginning of a second vision? If so, can you explain the connection of the two visions? https://bookofmormon.online/lehites/nephis-vision/6"
    },
    {
      "seq": "1129",
      "time": "2022-04-11T13:39:36.000Z",
      "content": "How does Amulek understand the experiment that Alma is going to propose? https://bookofmormon.online/reign-of-judges/zoramites/18"
    },
    {
      "seq": "416",
      "time": "2022-04-11T20:31:02.000Z",
      "content": "How does fine clothing rob the poor? Our society puts a great emphasis on fashion. Might we sometimes be guilty of robbing the poor with our fine clothing? How? What is the alternative? https://bookofmormon.online/nephis-teachings/43"
    },
    {
      "seq": "1686",
      "time": "2022-04-12T03:22:27.000Z",
      "content": "Notice that though Book of Mormon prophets have taken Nephite defeat as a sign of Nephite wickedness, Mormon does not take Nephite victory as a sign of Nephite righteousness. Does this tell us anything about our own situation? https://bookofmormon.online/downfall/43"
    },
    {
      "seq": "313",
      "time": "2022-04-12T10:13:53.000Z",
      "content": "Does reference back to 2 Nephi 4:33 add any meaning to this verse? https://bookofmormon.online/jacobs-sermon/26"
    },
    {
      "seq": "1787",
      "time": "2022-04-12T17:05:19.000Z",
      "content": "What’s the connection between weaknesses on the one hand and faith, hope, and charity on the other? https://bookofmormon.online/moroni/76"
    },
    {
      "seq": "1687",
      "time": "2022-04-12T23:56:45.000Z",
      "content": "What does it mean to say that Mormon loves his people? They are so wicked that he will no longer lead them. How can he love them? https://bookofmormon.online/downfall/87"
    },
    {
      "seq": "627",
      "time": "2022-04-13T06:48:10.000Z",
      "content": "What does “he cometh unto his own” mean? What salvation is Benjamin speaking of? Salvation from what? https://bookofmormon.online/benjamin/41"
    },
    {
      "seq": "980",
      "time": "2022-04-13T13:39:36.000Z",
      "content": "The most common synonym for mystery is secret. If many know the mysteries of God, how are they a secret? Notice that these words occur much more often in Restoration scriptures than in the Bible. Why do you think that is? https://bookofmormon.online/reign-of-judges/ammonihah/86"
    },
    {
      "seq": "141",
      "time": "2022-04-13T20:31:02.000Z",
      "content": "At the end of the verse, Nephi says that some people set the Lord “at naught, and hearken not to the voice of his counsels.” Is he using parallelism to explain what he means by “setting the Lord at naught”? https://bookofmormon.online/promised-land/9"
    },
    {
      "seq": "65",
      "time": "2022-04-14T03:22:27.000Z",
      "content": "Notice that the chronological order of the elements of the vision doesn’t correspond to the historical order. What does that tell us about visions? About historical order? https://bookofmormon.online/lehites/nephis-vision/15"
    },
    {
      "seq": "458",
      "time": "2022-04-14T10:13:53.000Z",
      "content": "What kinds of things do we “perform to the Lord”? What is the significance of using to rather than for? https://bookofmormon.online/nephis-testimony/14"
    },
    {
      "seq": "930",
      "time": "2022-04-14T17:05:19.000Z",
      "content": "Is Alma using humility and having one’s garments washed clean as parallel concepts in this verse? If not, why does he particularly mention humility? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/16"
    },
    {
      "seq": "61",
      "time": "2022-04-14T23:56:45.000Z",
      "content": "Why do you think that Nephi doesn’t mention the contrasting river of filthy water in this part of his account, though he seems to have seen it? (Compare 1 Nephi 8:13; 15:26–29.) https://bookofmormon.online/lehites/nephis-vision/13"
    },
    {
      "seq": "1219",
      "time": "2022-04-15T06:48:10.000Z",
      "content": "Notice that when Alma speaks of the severity of Corianton’s sins, he says “ these sins.” To what is he referring, to Corianton’s sin with regard to Isabel (verse 3) or to that sin and his pride (verses 2–3)? https://bookofmormon.online/reign-of-judges/corianton/2"
    },
    {
      "seq": "1605",
      "time": "2022-04-15T13:39:36.000Z",
      "content": "What is being prophesied here? Few of us own horses anymore, and I suspect none of us has a chariot. https://bookofmormon.online/jesus-teachings/33"
    },
    {
      "seq": "1362",
      "time": "2022-04-15T20:31:02.000Z",
      "content": "Speaking by the commandments isn’t the same as not speaking what is contrary to them. What is the difference? What might the writer be indicating by saying that nothing Nephi said was contrary to the commandments? https://bookofmormon.online/nephi/6"
    },
    {
      "seq": "300",
      "time": "2022-04-16T03:22:27.000Z",
      "content": "Who are the uncircumcised and unclean? https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "30",
      "time": "2022-04-16T10:13:53.000Z",
      "content": "Why does this vision occur on a high mountain? How is Nephi’s experience like that of others? Is there any significance to that parallel? https://bookofmormon.online/lehites/96"
    },
    {
      "seq": "1325",
      "time": "2022-04-16T17:05:19.000Z",
      "content": "To “dwindle” is to shrink, to become smaller. Here it seems to be used in opposition to “prosper.” What might it mean? https://bookofmormon.online/gadianton/33"
    },
    {
      "seq": "1815",
      "time": "2022-04-16T23:56:45.000Z",
      "content": "What does it mean to be “continually watchful unto prayer”? How do we keep each other “continually watchful unto prayer”? https://bookofmormon.online/moroni/96"
    },
    {
      "seq": "1611",
      "time": "2022-04-17T06:48:10.000Z",
      "content": "Why is this chapter from Isaiah important to the Nephites? To us? https://bookofmormon.online/jesus-teachings/41"
    },
    {
      "seq": "121",
      "time": "2022-04-17T13:39:36.000Z",
      "content": "Laman, Lemuel, and the sons of Ishmael didn’t murmur when they departed quickly (verses 10–11), but they do murmur now. What does that difference tell us? What does Lehi’s murmuring suggest? https://bookofmormon.online/lehites/119"
    },
    {
      "seq": "496",
      "time": "2022-04-17T20:31:02.000Z",
      "content": "What does it mean to “obtain a hope in Christ”? How do we obtain that hope? https://bookofmormon.online/jacobs-address/8"
    },
    {
      "seq": "619",
      "time": "2022-04-18T03:22:27.000Z",
      "content": "Why does Benjamin remind them of what happens to those who rebel as well as what happens to those who are faithful? https://bookofmormon.online/benjamin/29"
    },
    {
      "seq": "444",
      "time": "2022-04-18T10:13:53.000Z",
      "content": "What does it mean to speak with the tongue of angels? Is it significant that tongue is singular rather than plural, though angels is plural? What is the connection between having the Holy Ghost and speaking with the tongue of angels? https://bookofmormon.online/nephis-testimony/6"
    },
    {
      "seq": "71",
      "time": "2022-04-18T17:05:19.000Z",
      "content": "How do those three versions of the building fit with one another? https://bookofmormon.online/lehites/nephis-vision/19"
    },
    {
      "seq": "517",
      "time": "2022-04-18T23:56:45.000Z",
      "content": "Who are the “beloved brethren” to whom Jacob refers in verse 3? https://bookofmormon.online/land-of-nephi/15"
    },
    {
      "seq": "963",
      "time": "2022-04-19T06:48:10.000Z",
      "content": "In what sense has more than one person testified of the things that the people of Ammonihah are accused of? Alma accused them and mentioned things to come, but Amulek didn’t. https://bookofmormon.online/reign-of-judges/ammonihah/47"
    },
    {
      "seq": "1316",
      "time": "2022-04-19T13:39:36.000Z",
      "content": "What does it mean to go no more out? Out of where? When did we go out the first time? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "435",
      "time": "2022-04-19T20:31:02.000Z",
      "content": "We usually say that baptism is for the remission of sin. Though that is true, apparently it isn’t the only reason for baptism, for if it were, Christ wouldn’t need to be baptized. What other purpose or purposes might baptism also serve? https://bookofmormon.online/nephis-testimony/3"
    },
    {
      "seq": "1841",
      "time": "2022-04-20T03:22:27.000Z",
      "content": "What does this verse promise? Does Moroni use sanctified here to mean what we mean when we speak of exaltation, or does it have another meaning? What does this verse add to our understanding of what it means to be perfect? https://bookofmormon.online/moroni/117"
    },
    {
      "seq": "1353",
      "time": "2022-04-20T10:13:53.000Z",
      "content": "Why speak of them as “ firm to keep the commandments”? https://bookofmormon.online/nephi/3"
    },
    {
      "seq": "203",
      "time": "2022-04-20T17:05:19.000Z",
      "content": "What did the devil seek that was “evil before God”? Are there times when we seek something similar? How? https://bookofmormon.online/promised-land/lehi/33"
    },
    {
      "seq": "822",
      "time": "2022-04-20T23:56:45.000Z",
      "content": "How do you account for the see-saw of emotions that we see here? What effect do you think that see-saw would have? https://bookofmormon.online/zarahemla/42"
    },
    {
      "seq": "1210",
      "time": "2022-04-21T06:48:10.000Z",
      "content": "Alma sees the world and its history in terms of types and shadows. How does that help him understand the work of the Lord? Do we understand the world in the same way? Can we? How? https://bookofmormon.online/reign-of-judges/helaman/27"
    },
    {
      "seq": "133",
      "time": "2022-04-21T13:39:36.000Z",
      "content": "In verse 22, Nephi’s brothers say that they know that the people of Jerusalem were righteous because they kept the law of Moses. Were they wrong about that, or is their standard of righteousness the problem? https://bookofmormon.online/lehites/144"
    },
    {
      "seq": "1606",
      "time": "2022-04-21T20:31:02.000Z",
      "content": "What are soothsayers? Do we find them among us in any significant numbers? What is this scripture prophesying? https://bookofmormon.online/jesus-teachings/33"
    },
    {
      "seq": "137",
      "time": "2022-04-22T03:22:27.000Z",
      "content": "How does Nephi explain Israel’s salvation? Is it because Israel was worthy of salvation? https://bookofmormon.online/lehites/150"
    },
    {
      "seq": "1230",
      "time": "2022-04-22T10:13:53.000Z",
      "content": "Why must there be a space between death and the resurrection? Why can’t it be immediate or almost immediate? https://bookofmormon.online/reign-of-judges/corianton/10"
    },
    {
      "seq": "1018",
      "time": "2022-04-22T17:05:19.000Z",
      "content": "Do you think Alma has entered into the Lord’s rest? If so, how is it that he can still feel pain and anxiety? How are those compatible with rest? (Does the Lord feel pain and anxiety?) https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "213",
      "time": "2022-04-22T23:56:45.000Z",
      "content": "What does it mean to be free “according to the flesh”? Is that different from being free to act rather than to be acted upon? https://bookofmormon.online/promised-land/lehi/38"
    },
    {
      "seq": "438",
      "time": "2022-04-23T06:48:10.000Z",
      "content": "Nephi gives another reason for Jesus’s baptism. What is it? Why is that an important lesson for us? How is it related to the teaching of verses 7–8? https://bookofmormon.online/nephis-testimony/5"
    },
    {
      "seq": "1062",
      "time": "2022-04-23T13:39:36.000Z",
      "content": "We usually think of blessings as good things that come to us. Why is it a blessing (verse 2) to be an instrument in God’s hands (verse 3)? Does that suggest that perhaps we should reconsider how we think about blessings? https://bookofmormon.online/ammon/132"
    },
    {
      "seq": "1501",
      "time": "2022-04-23T20:31:02.000Z",
      "content": "We can see a division in the sermon at verse 11: the Beatitudes (verses 4–10) give us the general description of the gospel, and the verses that follow expand on that general description. https://bookofmormon.online/jesus/66"
    },
    {
      "seq": "1186",
      "time": "2022-04-24T03:22:27.000Z",
      "content": "Why does God make our burdens light rather than remove them? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/49"
    },
    {
      "seq": "878",
      "time": "2022-04-24T10:13:53.000Z",
      "content": "What is necessary in order to have a king? Are the judges that Mosiah suggests as rulers the same or similar to the judges of ancient Israel, or is this a different system of government? How would you decide that question? https://bookofmormon.online/zarahemla/95"
    },
    {
      "seq": "1163",
      "time": "2022-04-24T17:05:19.000Z",
      "content": "What does “your ground is barren” mean? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/26"
    },
    {
      "seq": "944",
      "time": "2022-04-24T23:56:45.000Z",
      "content": "What are the sins of the people of Zarahemla? Are our sins today the same, or do we have different problems? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/34"
    },
    {
      "seq": "1212",
      "time": "2022-04-25T06:48:10.000Z",
      "content": "Why do you think Alma explains his conversion so briefly to Shiblon but explained it at length to Helaman? https://bookofmormon.online/reign-of-judges/shiblon/4"
    },
    {
      "seq": "198",
      "time": "2022-04-25T13:39:36.000Z",
      "content": "To what does “these things” refer in the phrase “if these things are not there is no God”—to righteousness, happiness, punishment, and misery, or only to the last two? https://bookofmormon.online/promised-land/lehi/29"
    },
    {
      "seq": "1689",
      "time": "2022-04-25T20:31:02.000Z",
      "content": "What has changed so that Mormon will no longer help them? What do the Nephites now want that they didn’t seem to want before? What might that say to us about our attitudes toward our enemies? https://bookofmormon.online/downfall/88"
    },
    {
      "seq": "895",
      "time": "2022-04-26T03:22:27.000Z",
      "content": "Is Alma saying that this is the first case of priestcraft since Lehi’s colony arrived? Why would priestcraft result in the destruction of the people? Do we have priestcraft among us today? Outside the Church? In it? https://bookofmormon.online/reign-of-judges/6"
    },
    {
      "seq": "1706",
      "time": "2022-04-26T10:13:53.000Z",
      "content": "Does this verse forbid the remnant from taking up arms to defend the countries in North, Central, and South America in which they live? What does it mean? https://bookofmormon.online/mormon/91"
    },
    {
      "seq": "801",
      "time": "2022-04-26T17:05:19.000Z",
      "content": "Notice that Abinadi may have known from the beginning that this would happen. https://bookofmormon.online/recolonization/48"
    },
    {
      "seq": "1214",
      "time": "2022-04-26T23:56:45.000Z",
      "content": "Do you think that Alma gives this counsel to Shiblon because he knows what things tempt Shiblon? What kind of intemperance do you think Shiblon might find tempting? Are there any suggestions in these verses? https://bookofmormon.online/reign-of-judges/shiblon/6"
    },
    {
      "seq": "382",
      "time": "2022-04-27T06:48:10.000Z",
      "content": "Why does Nephi’s point about being saved by grace follow his statement of his purposes for writing? Why make that point here? https://bookofmormon.online/nephis-teachings/11"
    },
    {
      "seq": "1063",
      "time": "2022-04-27T13:39:36.000Z",
      "content": "What in Ammon’s exulting might have made Aaron think that Ammon had begun to boast? Why is Aaron so concerned about that possibility? Is Mosiah 4:5–11 relevant? https://bookofmormon.online/ammon/138"
    },
    {
      "seq": "1434",
      "time": "2022-04-27T20:31:02.000Z",
      "content": "How would you say this verse in your own words? https://bookofmormon.online/mormon/1"
    },
    {
      "seq": "849",
      "time": "2022-04-28T03:22:27.000Z",
      "content": "The angel commanded Alma the Younger to stop destroying the church, even if he himself wanted to be destroyed. He said nothing to him or to the sons of Mosiah about being converted. How can his father be so confident that he will be saved? https://bookofmormon.online/zarahemla/76"
    },
    {
      "seq": "1205",
      "time": "2022-04-28T10:13:53.000Z",
      "content": "What do verses 25–29 have to do with us today? Anything? https://bookofmormon.online/reign-of-judges/helaman/21"
    },
    {
      "seq": "1577",
      "time": "2022-04-28T17:05:19.000Z",
      "content": "Did everyone witness Jesus’s appearance? https://bookofmormon.online/jesus/148"
    },
    {
      "seq": "749",
      "time": "2022-04-28T23:56:45.000Z",
      "content": "How ironic that they should ask him about a scripture concerning prophets and the heralding of God’s kingdom on earth. Why do you think they asked him about this particular scripture? https://bookofmormon.online/recolonization/37"
    },
    {
      "seq": "1436",
      "time": "2022-04-29T06:48:10.000Z",
      "content": "What does it mean to be a disciple? Might Mormon be using disciple as we use apostle? What does it mean to have everlasting life? https://bookofmormon.online/mormon/47"
    },
    {
      "seq": "1600",
      "time": "2022-04-29T13:39:36.000Z",
      "content": "These verses repeat the warning given in 16:8–10. Why is this warning emphasized? https://bookofmormon.online/jesus-teachings/13"
    },
    {
      "seq": "48",
      "time": "2022-04-29T20:31:02.000Z",
      "content": "What do you make of the fact that verses 13 and 15 describe the virgin in the same language used in verses 8–9 to describe the tree? https://bookofmormon.online/lehites/nephis-vision/7"
    },
    {
      "seq": "263",
      "time": "2022-04-30T03:22:27.000Z",
      "content": "What service is it that the Gentiles will perform for Israel (verse 7)? What is the Lord promising the house of Israel? https://bookofmormon.online/jacobs-sermon/3"
    },
    {
      "seq": "573",
      "time": "2022-04-30T10:13:53.000Z",
      "content": "How does his description of the Lamanites compare with his description of them as his brethren? What do we see about Enos in these things? https://bookofmormon.online/land-of-nephi/35"
    },
    {
      "seq": "747",
      "time": "2022-04-30T17:05:19.000Z",
      "content": "Notice that Noah isn’t willing to decide on his own what would be good to do with Abinadi. Do you sense fear on Noah’s part? https://bookofmormon.online/recolonization/35"
    },
    {
      "seq": "1250",
      "time": "2022-04-30T23:56:45.000Z",
      "content": "Why can’t there be repentance if there isn’t a punishment? https://bookofmormon.online/reign-of-judges/corianton/34"
    },
    {
      "seq": "1110",
      "time": "2022-05-01T06:48:10.000Z",
      "content": "Alma identifies the man’s question: “What shall we do?—for we are cast out of our synagogues?” He responds with two rhetorical questions. How do those questions answer their question? Why isn’t this the end of Alma’s sermon? https://bookofmormon.online/reign-of-judges/zoramites/21"
    },
    {
      "seq": "629",
      "time": "2022-05-01T13:39:36.000Z",
      "content": "To what is he referring when he says “all these things”? How do those things make a righteous judgment? https://bookofmormon.online/benjamin/42"
    },
    {
      "seq": "384",
      "time": "2022-05-01T20:31:02.000Z",
      "content": "What does it mean to be alive in Christ? https://bookofmormon.online/nephis-teachings/12"
    },
    {
      "seq": "761",
      "time": "2022-05-02T03:22:27.000Z",
      "content": "The law was given, with its performances and ordinances, to make them remember the Lord. What might that say about our own law? https://bookofmormon.online/recolonization/abinadi/17"
    },
    {
      "seq": "1566",
      "time": "2022-05-02T10:13:53.000Z",
      "content": "The language here is slightly odd. How do we do the sacrament to those who repent and are baptized? What is the significance of that usage? https://bookofmormon.online/jesus/130"
    },
    {
      "seq": "631",
      "time": "2022-05-02T17:05:19.000Z",
      "content": "What does it mean to be stiff-necked? What does it mean to say that the law of Moses was given because the people were stiff-necked? What is it about the law of Moses that makes it appropriate for such a people? https://bookofmormon.online/benjamin/46"
    },
    {
      "seq": "1781",
      "time": "2022-05-02T23:56:45.000Z",
      "content": "The wording of this verse indicates that we can partake of the heavenly gift even before our hope is realized. How does trusting in the Lord (having faith) make it possible for us to partake of the gift? https://bookofmormon.online/moroni/69"
    },
    {
      "seq": "544",
      "time": "2022-05-03T06:48:10.000Z",
      "content": "The master says, “Let’s cut all of them down and burn them,” but the servant asks him to wait and he agrees. https://bookofmormon.online/olive-tree/32"
    },
    {
      "seq": "196",
      "time": "2022-05-03T13:39:36.000Z",
      "content": "The phrase “no purpose in the end of its creation” is odd since purpose and end seem to mean the same thing in this case. What do you make of that odd phrasing? https://bookofmormon.online/promised-land/lehi/28"
    },
    {
      "seq": "1599",
      "time": "2022-05-03T20:31:02.000Z",
      "content": "What does it mean to say they are the children of the prophets? https://bookofmormon.online/jesus-teachings/11"
    },
    {
      "seq": "151",
      "time": "2022-05-04T03:22:27.000Z",
      "content": "The Lord says he will save Israel for his own sake. Does this mean he won’t be doing it for Israel’s sake? Does this contradict Moses 1:39? https://bookofmormon.online/brass-plates/3"
    },
    {
      "seq": "929",
      "time": "2022-05-04T10:13:53.000Z",
      "content": "Does it make sense to understand these questions as tests we can use to answer the question “Am I clean?” https://bookofmormon.online/reign-of-judges/zarahemla-sermon/16"
    },
    {
      "seq": "1620",
      "time": "2022-05-04T17:05:19.000Z",
      "content": "What does it mean to be established in righteousness? https://bookofmormon.online/jesus-teachings/46"
    },
    {
      "seq": "1285",
      "time": "2022-05-04T23:56:45.000Z",
      "content": "What are the three possible explanations Moroni can think of for Pahoran’s failure to help? Why doesn’t he think of the actual explanation? https://bookofmormon.online/war/east/70"
    },
    {
      "seq": "1813",
      "time": "2022-05-05T06:48:10.000Z",
      "content": "Why does Moroni think it was important to keep the names of those who joined the people of the church? https://bookofmormon.online/moroni/96"
    },
    {
      "seq": "1470",
      "time": "2022-05-05T13:39:36.000Z",
      "content": "Why are the prophets’ testimonies of these events important? https://bookofmormon.online/mormon/55"
    },
    {
      "seq": "445",
      "time": "2022-05-05T20:31:02.000Z",
      "content": "Why is the Holy Ghost necessary if we wish to shout praises to the Holy One of Israel? To whom does “the Holy One of Israel” refer? What is the significance of that name? https://bookofmormon.online/nephis-testimony/6"
    },
    {
      "seq": "1744",
      "time": "2022-05-06T03:22:27.000Z",
      "content": "Why do Moroni, Mormon, and the other writers have to rid themselves of the blood of their brothers and sisters? Why would that blood be on them? https://bookofmormon.online/moroni/31"
    },
    {
      "seq": "1087",
      "time": "2022-05-06T10:13:53.000Z",
      "content": "Whose genius and power can we rely on if not our own? Does this have anything to do with the question of grace and works? Which is Korihor preaching? https://bookofmormon.online/reign-of-judges/korihor/4"
    },
    {
      "seq": "1113",
      "time": "2022-05-06T17:05:19.000Z",
      "content": "Are we blessed if we are humbled against our wills? Why would we be given mercy if our humility was imposed on us? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/2"
    },
    {
      "seq": "803",
      "time": "2022-05-06T23:56:45.000Z",
      "content": "Of what is Abinadi prophesying in this verse? https://bookofmormon.online/recolonization/50"
    },
    {
      "seq": "1579",
      "time": "2022-05-07T06:48:10.000Z",
      "content": "Why are this event and that related in 3 Nephi 17:24 so similar? What do those similarities suggest? Do they teach us something? https://bookofmormon.online/jesus/156"
    },
    {
      "seq": "1329",
      "time": "2022-05-07T13:39:36.000Z",
      "content": "Why are King Benjamin’s words so important to the people of the Book of Mormon? What value should they have to us? What would show that they have that value in our lives? https://bookofmormon.online/gadianton/41"
    },
    {
      "seq": "1405",
      "time": "2022-05-07T20:31:02.000Z",
      "content": "In concrete, contemporary terms, what does it mean to have one’s heart set upon riches? https://bookofmormon.online/samuel/14"
    },
    {
      "seq": "278",
      "time": "2022-05-08T03:22:27.000Z",
      "content": "How would one “look unto Abraham . . . and unto Sarah”? What is the Lord commanding here? https://bookofmormon.online/jacobs-sermon/12"
    },
    {
      "seq": "298",
      "time": "2022-05-08T10:13:53.000Z",
      "content": "If those the Lord is addressing are drunk with something other than wine (verse 21), what is it? (See verse 22 for some hints.) https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "1564",
      "time": "2022-05-08T17:05:19.000Z",
      "content": "Is it significant that he says “ye do always remember me” rather than “ye will always remember me”? https://bookofmormon.online/jesus/126"
    },
    {
      "seq": "223",
      "time": "2022-05-08T23:56:45.000Z",
      "content": "To what degree has this prophecy been fulfilled? If you think it is still being fulfilled, what would it take for it to be completed? https://bookofmormon.online/promised-land/lehi/45"
    },
    {
      "seq": "809",
      "time": "2022-05-09T06:48:10.000Z",
      "content": "Alma hides by day and, evidently, preaches at night. Though he preaches in secret, a good number of people hear his teaching. Yet the king’s men cannot find him. What might this say about the relation of the king to the people? https://bookofmormon.online/alma/1"
    },
    {
      "seq": "902",
      "time": "2022-05-09T13:39:36.000Z",
      "content": "Amlici commands his people to go to war so that he can subjugate them. How does going to war do that? Do you know of contemporary examples of someone using a declaration of war to subjugate his people? What lesson is there in this for us? https://bookofmormon.online/reign-of-judges/19"
    },
    {
      "seq": "856",
      "time": "2022-05-09T20:31:02.000Z",
      "content": "What does it mean to repent “nigh unto death”? What does it mean to be snatched from an everlasting burning? ( D&C 19:6–12 may be relevant here.) https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "528",
      "time": "2022-05-10T03:22:27.000Z",
      "content": "What does it mean to be presented as the “first-fruits”? https://bookofmormon.online/land-of-nephi/23"
    },
    {
      "seq": "1624",
      "time": "2022-05-10T10:13:53.000Z",
      "content": "Why would a prophecy of the last days be important to the Nephites? https://bookofmormon.online/jesus/184"
    },
    {
      "seq": "535",
      "time": "2022-05-10T17:05:19.000Z",
      "content": "The master has the old grafted tree dug about, pruned, and nourished, saying he has grafted in the new branches in an attempt to save the root. https://bookofmormon.online/olive-tree/7"
    },
    {
      "seq": "634",
      "time": "2022-05-10T23:56:45.000Z",
      "content": "Is there any significance to the name of the Lord used here? Does it relate to the content of the verse in some way? https://bookofmormon.online/benjamin/49"
    },
    {
      "seq": "424",
      "time": "2022-05-11T06:48:10.000Z",
      "content": "Can you explain what it means to say that the devil cheats the souls of those who are pacified? How does he do that? Of what does he cheat them? https://bookofmormon.online/nephis-teachings/47"
    },
    {
      "seq": "1778",
      "time": "2022-05-11T13:39:36.000Z",
      "content": "Why would we not receive a witness until after our faith (trust) had been tested? https://bookofmormon.online/moroni/67"
    },
    {
      "seq": "887",
      "time": "2022-05-11T20:31:02.000Z",
      "content": "Is Mosiah arguing that it is too difficult to be king, even for a righteous person, so no one should ask someone to be king? Why would that argument be different for a king than for any other leader? https://bookofmormon.online/zarahemla/92"
    },
    {
      "seq": "1746",
      "time": "2022-05-12T03:22:27.000Z",
      "content": "What promise did Jared’s people receive? To whom has this promise been made? https://bookofmormon.online/jaredites/9"
    },
    {
      "seq": "1017",
      "time": "2022-05-12T10:13:53.000Z",
      "content": "Though the Savior has already come, do we need to prepare people’s hearts to receive the news of his coming? If so, how do we do that? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1699",
      "time": "2022-05-12T17:05:19.000Z",
      "content": "Why does Mormon propose a battle? https://bookofmormon.online/downfall/121"
    },
    {
      "seq": "46",
      "time": "2022-05-12T23:56:45.000Z",
      "content": "Do you see any significance in the repetition of look in verses 8 and 12? https://bookofmormon.online/lehites/nephis-vision/7"
    },
    {
      "seq": "1556",
      "time": "2022-05-13T06:48:10.000Z",
      "content": "Jesus appears to have been ready to quit for the day. What moves him to continue? https://bookofmormon.online/jesus/116"
    },
    {
      "seq": "1254",
      "time": "2022-05-13T13:39:36.000Z",
      "content": "Here we see Alma’s principle for harrowing his son’s soul. What might this verse say about those who “cannot forgive themselves”? https://bookofmormon.online/reign-of-judges/corianton/40"
    },
    {
      "seq": "735",
      "time": "2022-05-13T20:31:02.000Z",
      "content": "What is the answer to the problem that Noah’s people are having with the Lamanites? https://bookofmormon.online/recolonization/30"
    },
    {
      "seq": "1837",
      "time": "2022-05-14T03:22:27.000Z",
      "content": "Moroni’s metaphor moves from clothing (“beautiful garments”) to tents (“strengthen thy stakes and enlarge thy borders”). Is that shift in the metaphor significant? https://bookofmormon.online/moroni/115"
    },
    {
      "seq": "554",
      "time": "2022-05-14T10:13:53.000Z",
      "content": "Do these verses suggest that perhaps Sherem was an outsider, someone who did not come from among Jacob’s people and was not a native speaker of their language? https://bookofmormon.online/land-of-nephi/29"
    },
    {
      "seq": "25",
      "time": "2022-05-14T17:05:19.000Z",
      "content": "How is obedience related to faithfulness? Does this way of thinking suggest a different way of thinking about obedience? https://bookofmormon.online/lehites/71"
    },
    {
      "seq": "1190",
      "time": "2022-05-14T23:56:45.000Z",
      "content": "Why do you think that Alma describes what he had done as murder? https://bookofmormon.online/zarahemla/74"
    },
    {
      "seq": "1695",
      "time": "2022-05-15T06:48:10.000Z",
      "content": "How can the Book of Mormon persuade the Jews that Jesus is the Christ? https://bookofmormon.online/mormon/83"
    },
    {
      "seq": "487",
      "time": "2022-05-15T13:39:36.000Z",
      "content": "What does it mean to “labor in sin”? Does anything in this verse help us understand why Jacob used somewhat in talking about their sins ( Jacob 1:15–16)? https://bookofmormon.online/jacobs-address/3"
    },
    {
      "seq": "502",
      "time": "2022-05-15T20:31:02.000Z",
      "content": "What has prompted the message Jacob is giving? How do we cause the daughters of Zion to mourn and have sorrow today? In verse 32, is the term men being used generically, or does it refer to male human beings? https://bookofmormon.online/jacobs-address/12"
    },
    {
      "seq": "1105",
      "time": "2022-05-16T03:22:27.000Z",
      "content": "The man who comes to Alma tells him that “they are despised of all men.” Is he exaggerating? If so, why would he do so? https://bookofmormon.online/reign-of-judges/zoramites/19"
    },
    {
      "seq": "1461",
      "time": "2022-05-16T10:13:53.000Z",
      "content": "When Christ announces himself, why does he tell them he was with the Father from the beginning? Isn’t that true of all of us? Weren’t we also with the Father in the beginning? https://bookofmormon.online/jesus/23"
    },
    {
      "seq": "1009",
      "time": "2022-05-16T17:05:19.000Z",
      "content": "“These ordinances” were given so people could look forward to Christ. How do those ordinances do that? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1834",
      "time": "2022-05-16T23:56:45.000Z",
      "content": "Moroni gives a summary of the things that his father, Mormon, taught in the last part of his sermon ( Moroni 7). Moroni has already given us the sermon, so why does he think it needs to be repeated here? https://bookofmormon.online/moroni/107"
    },
    {
      "seq": "595",
      "time": "2022-05-17T06:48:10.000Z",
      "content": "It has been more than four hundred years since Lehi left Jerusalem. That is like going to the temple to offer thanks now for something that happened in 1600. Why do the people come to the temple to offer thanks for that? https://bookofmormon.online/zarahemla/30"
    },
    {
      "seq": "503",
      "time": "2022-05-17T13:39:36.000Z",
      "content": "Why is what the Nephites have done worse than what the Lamanites did? (What did the Lamanites do?) As you think about this question, remember how Jacob tells us that he distinguishes Lamanites from Nephites ( Jacob 1:13–14). https://bookofmormon.online/jacobs-address/13"
    },
    {
      "seq": "641",
      "time": "2022-05-17T20:31:02.000Z",
      "content": "This is the first time Benjamin has mentioned works in this sermon. How do they fit in? What is the relation between belief and faith on the one hand and works on the other? https://bookofmormon.online/benjamin/55"
    },
    {
      "seq": "471",
      "time": "2022-05-18T03:22:27.000Z",
      "content": "If Jacob is talking about something like being converted, how is this description apt? https://bookofmormon.online/land-of-nephi/10"
    },
    {
      "seq": "805",
      "time": "2022-05-18T10:13:53.000Z",
      "content": "In what ways is Abinadi’s death a type of Noah’s and the priests’ future? Is it a type of the final future of those who rebel against God? https://bookofmormon.online/recolonization/50"
    },
    {
      "seq": "753",
      "time": "2022-05-18T17:05:19.000Z",
      "content": "Here Abinadi shows that they’ve not kept the law of Moses themselves, and neither have they taught it to the people. How is that related to what he said in verse 26 and 27? https://bookofmormon.online/recolonization/39"
    },
    {
      "seq": "626",
      "time": "2022-05-18T23:56:45.000Z",
      "content": "Notice again a contrast that Benjamin makes, the contrast between another lengthy name of the Lord and the name of His mother. What might the purpose of this contrast be? https://bookofmormon.online/benjamin/41"
    },
    {
      "seq": "601",
      "time": "2022-05-19T06:48:10.000Z",
      "content": "Why do the things Benjamin lists allow him to have a clear conscience? What do they show? https://bookofmormon.online/benjamin/5"
    },
    {
      "seq": "1373",
      "time": "2022-05-19T13:39:36.000Z",
      "content": "In the last chapter we saw that the Nephites remembered Moses and seemed to honor him. However, given the remark they make here, how well did they understand the gospel? https://bookofmormon.online/nephi/51"
    },
    {
      "seq": "711",
      "time": "2022-05-19T20:31:02.000Z",
      "content": "What does abound mean? https://bookofmormon.online/benjamin/101"
    },
    {
      "seq": "776",
      "time": "2022-05-20T03:22:27.000Z",
      "content": "Does it make a positive difference if we translate because as “although”? https://bookofmormon.online/recolonization/abinadi/28"
    },
    {
      "seq": "1172",
      "time": "2022-05-20T10:13:53.000Z",
      "content": "Alma equates prayer and worship. Why? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/33"
    },
    {
      "seq": "481",
      "time": "2022-05-20T17:05:19.000Z",
      "content": "In verse 16, Jacob gives two additional reasons for his sermon. Do you see anything in these verses that applies to us? https://bookofmormon.online/land-of-nephi/13"
    },
    {
      "seq": "1818",
      "time": "2022-05-20T23:56:45.000Z",
      "content": "Why does Moroni insert the remark about how to deal with transgressors in the middle of his description of Nephite worship? https://bookofmormon.online/moroni/98"
    },
    {
      "seq": "291",
      "time": "2022-05-21T06:48:10.000Z",
      "content": "In verse 15 we see that the Lord has power over all nature. How does this compare to the power feared by those who have forgotten him? https://bookofmormon.online/jacobs-sermon/16"
    },
    {
      "seq": "1784",
      "time": "2022-05-21T13:39:36.000Z",
      "content": "What does it mean to say that the Lord’s grace is sufficient? Sufficient for what? https://bookofmormon.online/moroni/76"
    },
    {
      "seq": "510",
      "time": "2022-05-21T20:31:02.000Z",
      "content": "How might these verses apply to us? What do they teach us about chastity? https://bookofmormon.online/promised-land/56"
    },
    {
      "seq": "1657",
      "time": "2022-05-22T03:22:27.000Z",
      "content": "How is “lifted up” being used here? https://bookofmormon.online/jesus/222"
    },
    {
      "seq": "1466",
      "time": "2022-05-22T10:13:53.000Z",
      "content": "What does the word redemption mean? What are some other circumstances in which we speak about redeeming something? Do those give us insight into the meaning of the word in scripture? What has redemption to do with Christ’s sacrifice? https://bookofmormon.online/jesus/24"
    },
    {
      "seq": "1796",
      "time": "2022-05-22T17:05:19.000Z",
      "content": "What does grace have to do with charity? https://bookofmormon.online/moroni/78"
    },
    {
      "seq": "1668",
      "time": "2022-05-22T23:56:45.000Z",
      "content": "What do the great and marvelous works they did have to do with the gospel Jesus preached? https://bookofmormon.online/mormon/71"
    },
    {
      "seq": "1107",
      "time": "2022-05-23T06:48:10.000Z",
      "content": "As you read what follows, ask yourself what kind of worship the questioner and his comrades were asking to take part in. (See Alma 31:12–18, 23.) https://bookofmormon.online/reign-of-judges/zoramites/19"
    },
    {
      "seq": "448",
      "time": "2022-05-23T13:39:36.000Z",
      "content": "What does “relying wholly upon the merits of him who is mighty to save” mean? (Compare Moroni 6:4.) What would it mean not to rely wholly on his merits? On what other merits might we rely? https://bookofmormon.online/nephis-testimony/9"
    },
    {
      "seq": "1035",
      "time": "2022-05-23T20:31:02.000Z",
      "content": "Why do you think King Lamoni was given the privilege of seeing the Redeemer in vision? https://bookofmormon.online/ammon/66"
    },
    {
      "seq": "117",
      "time": "2022-05-24T03:22:27.000Z",
      "content": "Why does he deliver the Liahona in such an unusual way (verse 10)? https://bookofmormon.online/lehites/112"
    },
    {
      "seq": "800",
      "time": "2022-05-24T10:13:53.000Z",
      "content": "One of the most common accusations made against prophets is blasphemy, the substance of the accusation made here against Abinadi. Why do you think that is so? https://bookofmormon.online/recolonization/47"
    },
    {
      "seq": "1666",
      "time": "2022-05-24T17:05:19.000Z",
      "content": "How does that make them all partakers of the heavenly gift? What is the heavenly gift? https://bookofmormon.online/mormon/69"
    },
    {
      "seq": "426",
      "time": "2022-05-24T23:56:45.000Z",
      "content": "What does it mean to be at ease in Zion? Isn’t Zion a place of rest (ease) and security? Is the ease this verse warns against a cessation of labor or the ease of conscience? https://bookofmormon.online/nephis-teachings/48"
    },
    {
      "seq": "181",
      "time": "2022-05-25T06:48:10.000Z",
      "content": "Why does Lehi connect resurrection to redemption? https://bookofmormon.online/promised-land/lehi/22"
    },
    {
      "seq": "1517",
      "time": "2022-05-25T13:39:36.000Z",
      "content": "What does verse 45 suggest that it means to be one of God’s children? Why might these verses have been even more important to the Nephites than they were to the Jews? https://bookofmormon.online/jesus/77"
    },
    {
      "seq": "34",
      "time": "2022-05-25T20:31:02.000Z",
      "content": "According to the Spirit, what will explain why Nephi will see the vision he wants to see? https://bookofmormon.online/lehites/nephis-vision/2"
    },
    {
      "seq": "314",
      "time": "2022-05-26T03:22:27.000Z",
      "content": "Why does Jacob identify himself with the wicked at the beginning of the verse (“we shall have a perfect knowledge of our guilt”)? https://bookofmormon.online/jacobs-sermon/26"
    },
    {
      "seq": "390",
      "time": "2022-05-26T10:13:53.000Z",
      "content": "What might this verse say about our own “law”? https://bookofmormon.online/nephis-teachings/13"
    },
    {
      "seq": "359",
      "time": "2022-05-26T17:05:19.000Z",
      "content": "What does it mean to say that the government will be on the shoulders of the Christ child? What is the alternative? In other words, what would it mean for the government not to be on his shoulders? https://bookofmormon.online/isaiah/52"
    },
    {
      "seq": "1530",
      "time": "2022-05-26T23:56:45.000Z",
      "content": "What does this verse say about the connection between our relation to others and our salvation? https://bookofmormon.online/jesus/81"
    },
    {
      "seq": "896",
      "time": "2022-05-27T06:48:10.000Z",
      "content": "What is Alma’s justification for the death penalty? https://bookofmormon.online/reign-of-judges/6"
    },
    {
      "seq": "290",
      "time": "2022-05-27T13:39:36.000Z",
      "content": "What is the contrast between the pit mentioned in verse 14 and that of verse 1? https://bookofmormon.online/jacobs-sermon/16"
    },
    {
      "seq": "886",
      "time": "2022-05-27T20:31:02.000Z",
      "content": "To what inequality is Mosiah referring? https://bookofmormon.online/zarahemla/101"
    },
    {
      "seq": "175",
      "time": "2022-05-28T03:22:27.000Z",
      "content": "Lehi says we are cut off from that which is good by the law—both by the temporal and by the spiritual law. What does it mean to be cut off from the Father by the temporal law? By the spiritual law? https://bookofmormon.online/promised-land/lehi/20"
    },
    {
      "seq": "519",
      "time": "2022-05-28T10:13:53.000Z",
      "content": "Once again we are told the purpose of the Book of Mormon. Why is it important for us to know that the Nephites and the prophets before them knew of Christ? https://bookofmormon.online/land-of-nephi/17"
    },
    {
      "seq": "1147",
      "time": "2022-05-28T17:05:19.000Z",
      "content": "What knowledge is perfect? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/21"
    },
    {
      "seq": "283",
      "time": "2022-05-28T23:56:45.000Z",
      "content": "What does it teach? What does it mean to say that the righteous have the law/instruction written in their hearts? https://bookofmormon.online/jacobs-sermon/14"
    },
    {
      "seq": "1588",
      "time": "2022-05-29T06:48:10.000Z",
      "content": "What does it mean that Jesus will be glorified in those who have been given him? How is he glorified—made more glorious—in us? https://bookofmormon.online/jesus/164"
    },
    {
      "seq": "1645",
      "time": "2022-05-29T13:39:36.000Z",
      "content": "We might expect Jesus to say something like, “I came into the world to do the will of my Father in order to make salvation available to all.” What is important about the reason he gives for his mission? https://bookofmormon.online/jesus/219"
    },
    {
      "seq": "115",
      "time": "2022-05-29T20:31:02.000Z",
      "content": "What does the fact that the wicked are cut to their center by the truth tell us about wickedness and truth? https://bookofmormon.online/lehites/109"
    },
    {
      "seq": "624",
      "time": "2022-05-30T03:22:27.000Z",
      "content": "Look at the list of activities described, and then think about the Gospels, particularly the synoptic Gospels (Matthew, Mark, and Luke). Why is there such an emphasis on these miracles? https://bookofmormon.online/benjamin/39"
    },
    {
      "seq": "318",
      "time": "2022-05-30T10:13:53.000Z",
      "content": "What does hearken mean? How do we hearken to the voice of the Lord? Is it possible to have faith but not to hearken or to hearken but not to have faith? https://bookofmormon.online/jacobs-sermon/29"
    },
    {
      "seq": "1374",
      "time": "2022-05-30T17:05:19.000Z",
      "content": "What does it mean to declare the word with unwearyingness? Does that mean Nephi didn’t get tired? He also has “not sought [his] own life.” What does that mean? https://bookofmormon.online/nephi/54"
    },
    {
      "seq": "1267",
      "time": "2022-05-30T23:56:45.000Z",
      "content": "How does this compare to contemporary diplomacy and peace negotiations? Are there any lessons to be learned? https://bookofmormon.online/war/22"
    },
    {
      "seq": "1582",
      "time": "2022-05-31T06:48:10.000Z",
      "content": "Why is this prayer to the Father primarily a prayer for the unity of the believers? What kind of unity does the Savior have in mind here? Is this particularly a response to the Nephites, or should we understand it in a broader context? https://bookofmormon.online/jesus/160"
    },
    {
      "seq": "1229",
      "time": "2022-05-31T13:39:36.000Z",
      "content": "It seems odd that Alma doesn’t care about the facts of the resurrection when we often make such a big deal about it. For him, it is enough to know that the dead will be resurrected. How would you explain that? What might it teach us? https://bookofmormon.online/reign-of-judges/corianton/9"
    },
    {
      "seq": "763",
      "time": "2022-05-31T20:31:02.000Z",
      "content": "Of what are the performances of the Mosaic law types (patterns)? How are they such types? https://bookofmormon.online/recolonization/abinadi/17"
    },
    {
      "seq": "1300",
      "time": "2022-06-01T03:22:27.000Z",
      "content": "Why do people seek power and authority? How do they do so? https://bookofmormon.online/gadianton/2"
    },
    {
      "seq": "468",
      "time": "2022-06-01T10:13:53.000Z",
      "content": "What has Nephi sealed on earth? How are we to understand that sealing power? Are there other times when we’ve seen it used? https://bookofmormon.online/nephis-testimony/20"
    },
    {
      "seq": "1565",
      "time": "2022-06-01T17:05:19.000Z",
      "content": "They are blessed for what they have done. Does this refer to the sacrament? If so, how is taking the sacrament “ fulfilling my commandments”? What is the connection between obeying the Savior and remembering him? https://bookofmormon.online/jesus/128"
    },
    {
      "seq": "1656",
      "time": "2022-06-01T23:56:45.000Z",
      "content": "What is his gospel? What is the pleasing message he has delivered? What works do we see Christ do in the scriptures? How do we do those works? https://bookofmormon.online/jesus/222"
    },
    {
      "seq": "325",
      "time": "2022-06-02T06:48:10.000Z",
      "content": "Does Jacob’s warning turn to a different kind of sin here? If so, what is the difference? What is the similarity of the sins of these verses to those of verses 28–33? https://bookofmormon.online/jacobs-sermon/34"
    },
    {
      "seq": "182",
      "time": "2022-06-02T13:39:36.000Z",
      "content": "What does the phrase “merits, and mercy, and grace” mean? Should we understand each of those three terms separately, or should we understand the phrase as a unit? https://bookofmormon.online/promised-land/lehi/22"
    },
    {
      "seq": "972",
      "time": "2022-06-02T20:31:02.000Z",
      "content": "Notice how Zeezrom’s one question brings a long, detailed response from Amulek. Why does Amulek answer as he does? Why not give Zeezrom a shorter, more simple answer? https://bookofmormon.online/reign-of-judges/ammonihah/72"
    },
    {
      "seq": "429",
      "time": "2022-06-03T03:22:27.000Z",
      "content": "The phrase “the doctrine of Christ” can be understood to mean “the doctrine that comes from Christ” or “the doctrine about Christ.” Which meaning do you think Nephi intends? https://bookofmormon.online/nephis-testimony/2"
    },
    {
      "seq": "1357",
      "time": "2022-06-03T10:13:53.000Z",
      "content": "What does the Lord mean when he says, “I will not show unto the wicked of my strength, to one more than the other”? Can you write out an English sentence that has an equivalent meaning? https://bookofmormon.online/nephi/11"
    },
    {
      "seq": "224",
      "time": "2022-06-03T17:05:19.000Z",
      "content": "Who are these verses about? What does it mean to say “he shall do none other work, save the work which I shall command him”? https://bookofmormon.online/promised-land/lehi/47"
    },
    {
      "seq": "981",
      "time": "2022-06-03T23:56:45.000Z",
      "content": "Here Alma indirectly explains why he told Zeezrom about temporal death and the resurrection. What is his explanation? What does it have to do with the mysteries of God? https://bookofmormon.online/reign-of-judges/ammonihah/86"
    },
    {
      "seq": "1226",
      "time": "2022-06-04T06:48:10.000Z",
      "content": "In addition to the personal consequences of sin, what are some of the other consequences? https://bookofmormon.online/reign-of-judges/corianton/4"
    },
    {
      "seq": "807",
      "time": "2022-06-04T13:39:36.000Z",
      "content": "Many of the conversion stories in the Book of Mormon are more detailed and more dramatic than this brief description of Alma’s repentance. (Compare Enos’s story and Alma the Younger’s, for example.) Why might this story be told so briefly? https://bookofmormon.online/alma/1"
    },
    {
      "seq": "443",
      "time": "2022-06-04T20:31:02.000Z",
      "content": "How is this teaching related to that of Moroni 7:6–11? https://bookofmormon.online/nephis-testimony/6"
    },
    {
      "seq": "1284",
      "time": "2022-06-05T03:22:27.000Z",
      "content": "What is the best thing the Nephites could have done to prevent the attacks of the Lamanites? https://bookofmormon.online/war/east/68"
    },
    {
      "seq": "391",
      "time": "2022-06-05T10:13:53.000Z",
      "content": "To whom does “the Gentiles” refer? Why must we understand that to understand the import of these verses? https://bookofmormon.online/nephis-teachings/21"
    },
    {
      "seq": "1177",
      "time": "2022-06-05T17:05:19.000Z",
      "content": "How do Alma’s concerns and the concerns of the Zoramites come together in this verse? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/41"
    },
    {
      "seq": "499",
      "time": "2022-06-05T23:56:45.000Z",
      "content": "Notice that he brings in the description of God as Creator again, as in verse 5. How is that relevant to his message? Why does Jacob say we were created? https://bookofmormon.online/jacobs-address/9"
    },
    {
      "seq": "598",
      "time": "2022-06-06T06:48:10.000Z",
      "content": "Benjamin says he has had them come so they can hear and understand, so they can learn the mysteries. Can you make a list of the mysteries that he teaches? https://bookofmormon.online/benjamin/1"
    },
    {
      "seq": "190",
      "time": "2022-06-06T13:39:36.000Z",
      "content": "If there must be opposition in all things for there to be good, why are those who oppose God’s law punished? https://bookofmormon.online/promised-land/lehi/26"
    },
    {
      "seq": "1660",
      "time": "2022-06-06T20:31:02.000Z",
      "content": "In what sense was the covenant the Lord made with the Israelites “already beginning to be fulfilled” when the Book of Mormon was revealed? https://bookofmormon.online/mormon/69"
    },
    {
      "seq": "1531",
      "time": "2022-06-07T03:22:27.000Z",
      "content": "Why does the Lord speak of the Father leading us into temptation in both versions of the prayer? https://bookofmormon.online/jesus/81"
    },
    {
      "seq": "319",
      "time": "2022-06-07T10:13:53.000Z",
      "content": "What reason does this verse give for the damnation of those who refuse to repent? Why is that the appropriate explanation for this discussion? In fact, what are we to make of an explanation like that? https://bookofmormon.online/jacobs-sermon/30"
    },
    {
      "seq": "799",
      "time": "2022-06-07T17:05:19.000Z",
      "content": "Noah was willing to kill Alma immediately (verse 3), but it takes him and his priests three days to come up with a pretext for killing Abinadi. What do you make of that difference? https://bookofmormon.online/recolonization/47"
    },
    {
      "seq": "1361",
      "time": "2022-06-07T23:56:45.000Z",
      "content": "How do riches cause pride? https://bookofmormon.online/nephi/14"
    },
    {
      "seq": "195",
      "time": "2022-06-08T06:48:10.000Z",
      "content": "What does destroy mean in this case? https://bookofmormon.online/promised-land/lehi/28"
    },
    {
      "seq": "15",
      "time": "2022-06-08T13:39:36.000Z",
      "content": "How is what we see in these verses connected to 1 Nephi 2:16? https://bookofmormon.online/lehites/23"
    },
    {
      "seq": "1472",
      "time": "2022-06-08T20:31:02.000Z",
      "content": "Is it significant that they didn’t understand the voice the first two times? If so, what might that inability to understand teach us? https://bookofmormon.online/jesus/39"
    },
    {
      "seq": "1231",
      "time": "2022-06-09T03:22:27.000Z",
      "content": "How does what Alma says here square with our understanding of the three degrees of glory? https://bookofmormon.online/reign-of-judges/corianton/11"
    },
    {
      "seq": "1334",
      "time": "2022-06-09T10:13:53.000Z",
      "content": "What gave Nephi and Lehi such power in preaching? https://bookofmormon.online/gadianton/47"
    },
    {
      "seq": "1309",
      "time": "2022-06-09T17:05:19.000Z",
      "content": "What is the word of God? How do we lay hold on it? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "527",
      "time": "2022-06-09T23:56:45.000Z",
      "content": "What does it mean to be reconciled through the Atonement? How do we do that? https://bookofmormon.online/land-of-nephi/23"
    },
    {
      "seq": "104",
      "time": "2022-06-10T06:48:10.000Z",
      "content": "To what does “the covenants of the Father unto the house of Israel” refer? Why does the angel ask Nephi whether he remembers those covenants before he shows Nephi a vision of the two churches? https://bookofmormon.online/lehites/nephis-vision/48"
    },
    {
      "seq": "1098",
      "time": "2022-06-10T13:39:36.000Z",
      "content": "Is Korihor beginning to backpedal here? Compare what he says in this verse to what he said at the end of verse 28. Is he changing his tune or not? What does he mean when he says, “I do not deny the existence of a God, but . . .”? https://bookofmormon.online/reign-of-judges/korihor/23"
    },
    {
      "seq": "724",
      "time": "2022-06-10T20:31:02.000Z",
      "content": "If something about his background might account for Noah’s wickedness, what can you imagine it might be? https://bookofmormon.online/recolonization/24"
    },
    {
      "seq": "472",
      "time": "2022-06-11T03:22:27.000Z",
      "content": "What does it mean to “enter into his rest”? Jacob probably knows the phrase “his rest” from Isaiah 11:10. Does that scripture shed any light on what he means? https://bookofmormon.online/land-of-nephi/10"
    },
    {
      "seq": "109",
      "time": "2022-06-11T10:13:53.000Z",
      "content": "Does this verse explain the angel’s question in verse 8? If so, how so? https://bookofmormon.online/lehites/nephis-vision/52"
    },
    {
      "seq": "1691",
      "time": "2022-06-11T17:05:19.000Z",
      "content": "He begins this verse with the word therefore. Is what follows in the rest of the chapter a conclusion from what came before? https://bookofmormon.online/mormon/74"
    },
    {
      "seq": "129",
      "time": "2022-06-11T23:56:45.000Z",
      "content": "Compare and contrast these two perspectives on the same event, asking yourself which things each includes that are the same and which things are different and what those similarities and differences suggest. https://bookofmormon.online/lehites/135"
    },
    {
      "seq": "245",
      "time": "2022-06-12T06:48:10.000Z",
      "content": "Why does this psalm of Nephi end in a prayer? In our more ordinary terms, what are the things Nephi prays for? https://bookofmormon.online/promised-land/50"
    },
    {
      "seq": "1162",
      "time": "2022-06-12T13:39:36.000Z",
      "content": "We already know that the seed is good (verse 33), so we can’t blame the death of the tree on the seed. What are the other possible explanations? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/26"
    },
    {
      "seq": "1365",
      "time": "2022-06-12T20:31:02.000Z",
      "content": "What danger is run by those who are prosperous and who have military power? https://bookofmormon.online/nephi/19"
    },
    {
      "seq": "354",
      "time": "2022-06-13T03:22:27.000Z",
      "content": "Why does the prophet use the past-tense verb form have seen to describe something in the future? https://bookofmormon.online/isaiah/51"
    },
    {
      "seq": "772",
      "time": "2022-06-13T10:13:53.000Z",
      "content": "In verse 7, in addition to the obvious reference to his appearance before Pilate, what might it mean that he didn’t open his mouth? https://bookofmormon.online/recolonization/abinadi/24"
    },
    {
      "seq": "1595",
      "time": "2022-06-13T17:05:19.000Z",
      "content": "What does it mean that when he brings his gospel from the Gentiles, he will give it to the house of Israel? To whom among them? What would it mean for the house of Israel to go among the nations and to tread them down? https://bookofmormon.online/jesus/113"
    },
    {
      "seq": "1569",
      "time": "2022-06-13T23:56:45.000Z",
      "content": "When the scriptures tell us to let our light shine before the world, what do they mean? Compare what Christ says here to 2 Nephi 31:12. https://bookofmormon.online/jesus/134"
    },
    {
      "seq": "1301",
      "time": "2022-06-14T06:48:10.000Z",
      "content": "How does priestcraft (see 2 Nephi 26:29) differ from Gadianton robbery? How is it the same? Which is more important for us to recognize, the similarity or the difference? https://bookofmormon.online/gadianton/2"
    },
    {
      "seq": "1468",
      "time": "2022-06-14T13:39:36.000Z",
      "content": "If we come as little children, we will become the children of God. How do we become as little children? https://bookofmormon.online/jesus/27"
    },
    {
      "seq": "1682",
      "time": "2022-06-14T20:31:02.000Z",
      "content": "What is the difference between the sorrow of the damned and the sorrow of the repentant? How do we distinguish between the two? (See 2 Corinthians 7:9–11.) https://bookofmormon.online/downfall/38"
    },
    {
      "seq": "1533",
      "time": "2022-06-15T03:22:27.000Z",
      "content": "Why does the Savior add this commentary on the prayer? Why is the only part of the prayer on which he comments the part about forgiveness? https://bookofmormon.online/jesus/82"
    },
    {
      "seq": "666",
      "time": "2022-06-15T10:13:53.000Z",
      "content": "not allow our children to go hungry or naked or to transgress the commandments (what does this say about child rearing?) https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1041",
      "time": "2022-06-15T17:05:19.000Z",
      "content": "What is troubling Lamoni’s father? Why would that trouble him? What does that suggest about our own social and legal obligations? https://bookofmormon.online/aaron/14"
    },
    {
      "seq": "415",
      "time": "2022-06-15T23:56:45.000Z",
      "content": "How do fine sanctuaries rob the poor? Is this something we must be cognizant of? https://bookofmormon.online/nephis-teachings/43"
    },
    {
      "seq": "207",
      "time": "2022-06-16T06:48:10.000Z",
      "content": "Does verse 14 shed any light on what this verse means by “knoweth all things” (italics added)? Does verse 18 shed any light on what it means to say that God knows all things? https://bookofmormon.online/promised-land/lehi/37"
    },
    {
      "seq": "1602",
      "time": "2022-06-16T13:39:36.000Z",
      "content": "What does it mean that the Lord’s people will know his name? https://bookofmormon.online/jesus-teachings/19"
    },
    {
      "seq": "1037",
      "time": "2022-06-16T20:31:02.000Z",
      "content": "What does it mean to have one’s heart changed and to have no more desire to do evil? (Compare Mosiah 5:2.) Is this an experience that people have today? If so, when? If not, why not? https://bookofmormon.online/ammon/78"
    },
    {
      "seq": "1346",
      "time": "2022-06-17T03:22:27.000Z",
      "content": "What does it mean to say that Satan is the author of all sin? Does that mean I am not the author of any sins? If he is the author of sin, how can I be held responsible? https://bookofmormon.online/gadianton/86"
    },
    {
      "seq": "1115",
      "time": "2022-06-17T10:13:53.000Z",
      "content": "Surely Alma is thinking of Korihor here. Why would that comparison be useful to the Zoramites? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/7"
    },
    {
      "seq": "920",
      "time": "2022-06-17T17:05:19.000Z",
      "content": "If we have already been created in the image of God, how can Alma ask whether those in Zarahemla have received that image? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/9"
    },
    {
      "seq": "1713",
      "time": "2022-06-17T23:56:45.000Z",
      "content": "To whom are these verses addressed? https://bookofmormon.online/moroni/7"
    },
    {
      "seq": "158",
      "time": "2022-06-18T06:48:10.000Z",
      "content": "Are there other parallels between Nephi’s vision and these parts of Isaiah’s writings? https://bookofmormon.online/brass-plates/15"
    },
    {
      "seq": "932",
      "time": "2022-06-18T13:39:36.000Z",
      "content": "What might Alma mean here by envy? How does envy prevent us from being in the presence of God? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/18"
    },
    {
      "seq": "1488",
      "time": "2022-06-18T20:31:02.000Z",
      "content": "Why does Jesus describe those he calls as ministers and servants? What sense does it make to tell people that they should pay attention to their servants? What is going on here? https://bookofmormon.online/jesus/50"
    },
    {
      "seq": "123",
      "time": "2022-06-19T03:22:27.000Z",
      "content": "For what kinds of reasons might Nephi have asked his father where he should go to hunt? https://bookofmormon.online/lehites/121"
    },
    {
      "seq": "377",
      "time": "2022-06-19T10:13:53.000Z",
      "content": "What does he mean when he says he will confine his words to his own people? https://bookofmormon.online/nephis-teachings/4"
    },
    {
      "seq": "952",
      "time": "2022-06-19T17:05:19.000Z",
      "content": "As Alma uses the phrase here, what is “the holy order of God”? Is that different from “the order of the church” in Alma 8:1? Is he using the word order here in the same way he used it in Alma 5:49? https://bookofmormon.online/reign-of-judges/gideon/15"
    },
    {
      "seq": "1118",
      "time": "2022-06-19T23:56:45.000Z",
      "content": "Alma recognizes that he has gotten off topic (verses 19–20), and he returns to the topic of faith. Why does he contrast faith and perfect knowledge rather than just faith and knowledge? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/9"
    },
    {
      "seq": "1622",
      "time": "2022-06-20T06:48:10.000Z",
      "content": "Here Jesus tells them why Isaiah is important. How would you explain what he says here in your own words? https://bookofmormon.online/jesus-teachings/48"
    },
    {
      "seq": "541",
      "time": "2022-06-20T13:39:36.000Z",
      "content": "When they return to the original, grafted tree, they discover that it bears a lot of fruit, none of it good. https://bookofmormon.online/olive-tree/23"
    },
    {
      "seq": "347",
      "time": "2022-06-20T20:31:02.000Z",
      "content": "Why does Jacob connect his teaching to what his father taught (compare verse 23 with 2:27–29)? https://bookofmormon.online/jacobs-sermon/50"
    },
    {
      "seq": "194",
      "time": "2022-06-21T03:22:27.000Z",
      "content": "What is God’s wisdom? His purpose? His power, mercy, and justice? Does Lehi mean this phrase to be understood as one thing, or does he mean us to understand each thing separately? https://bookofmormon.online/promised-land/lehi/28"
    },
    {
      "seq": "336",
      "time": "2022-06-21T10:13:53.000Z",
      "content": "What is the point of this verse? How does it relate to such things as Paul’s letter to the Romans where he teaches that salvation comes by grace? https://bookofmormon.online/jacobs-sermon/42"
    },
    {
      "seq": "1027",
      "time": "2022-06-21T17:05:19.000Z",
      "content": "Why are the people who are reporting Ammon’s deeds to the king less sure that he is the Great Spirit than Lamoni is? https://bookofmormon.online/ammon/25"
    },
    {
      "seq": "1025",
      "time": "2022-06-21T23:56:45.000Z",
      "content": "Ammon becomes a servant of the king. Is Christ the type that Ammon’s work shows here? Does this suggest something about what it means to be a Christian? https://bookofmormon.online/ammon/9"
    },
    {
      "seq": "1421",
      "time": "2022-06-22T06:48:10.000Z",
      "content": "What reason does the angel give for the signs of Christ’s birth in the New World? https://bookofmormon.online/samuel/38"
    },
    {
      "seq": "928",
      "time": "2022-06-22T13:39:36.000Z",
      "content": "Why is experiencing the change of heart described as singing “the song of redeeming love”? What does the question of this verse suggest is Alma’s concern for the people of Zarahemla? How is it an appropriate question for us? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/16"
    },
    {
      "seq": "1155",
      "time": "2022-06-22T20:31:02.000Z",
      "content": "Notice that this is the first time that Alma has said that the seed is that of a tree. Is that significant to understanding how his listeners would have heard what he was teaching? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "581",
      "time": "2022-06-23T03:22:27.000Z",
      "content": "How do we come to Christ? How do we partake of his salvation? Are coming to him and partaking of his salvation one thing or two? https://bookofmormon.online/land-of-nephi/42"
    },
    {
      "seq": "1352",
      "time": "2022-06-23T10:13:53.000Z",
      "content": "What does entreated mean? What does it mean to be easy to be entreated? https://bookofmormon.online/nephi/3"
    },
    {
      "seq": "746",
      "time": "2022-06-23T17:05:19.000Z",
      "content": "The people tell Noah to do what he thinks is good. Are they afraid to do it themselves? Why? https://bookofmormon.online/recolonization/34"
    },
    {
      "seq": "986",
      "time": "2022-06-23T23:56:45.000Z",
      "content": "Do you think Antionah’s questions are sincere? Why or why not? https://bookofmormon.online/reign-of-judges/ammonihah/97"
    },
    {
      "seq": "710",
      "time": "2022-06-24T06:48:10.000Z",
      "content": "What does it mean to be steadfast and immovable? Steadfast in what? Immovable with respect to what? https://bookofmormon.online/benjamin/101"
    },
    {
      "seq": "74",
      "time": "2022-06-24T13:39:36.000Z",
      "content": "What does “pride of the world” mean here (verse 36)? https://bookofmormon.online/lehites/nephis-vision/19"
    },
    {
      "seq": "827",
      "time": "2022-06-24T20:31:02.000Z",
      "content": "Notice that in order to understand the scriptures we must believe. https://bookofmormon.online/zarahemla/51"
    },
    {
      "seq": "645",
      "time": "2022-06-25T03:22:27.000Z",
      "content": "What do they ask for? How does that explain the question above? https://bookofmormon.online/benjamin/60"
    },
    {
      "seq": "1698",
      "time": "2022-06-25T10:13:53.000Z",
      "content": "Is Mormon saying something contradictory here? If Christ was their shepherd, how can they be led by the Father? Is he perhaps speaking of Christ as the Father (compare Mosiah 15:2)? https://bookofmormon.online/mormon/86"
    },
    {
      "seq": "1091",
      "time": "2022-06-25T17:05:19.000Z",
      "content": "Here Korihor adds an element to his explanation of religion. What is it? Why might he think that explanation could work among the Nephites and the people of Ammon? https://bookofmormon.online/reign-of-judges/korihor/9"
    },
    {
      "seq": "1010",
      "time": "2022-06-25T23:56:45.000Z",
      "content": "Alma says that “it” is a type of the Son of God’s order and intends that to explain how the people look forward to Christ. To what does the word it refer? How does what it refers to help them look forward to a remission of sins? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "38",
      "time": "2022-06-26T06:48:10.000Z",
      "content": "Is it significant that Nephi says the tree he saw was like the tree his father saw (verse 8)? What tree does Nephi see? What justifies your answer? https://bookofmormon.online/lehites/nephis-vision/5"
    },
    {
      "seq": "1782",
      "time": "2022-06-26T13:39:36.000Z",
      "content": "What things does Moroni show us with this list? https://bookofmormon.online/moroni/70"
    },
    {
      "seq": "797",
      "time": "2022-06-26T20:31:02.000Z",
      "content": "How does this verse describe the situation of Abinadi’s audience? https://bookofmormon.online/recolonization/abinadi/54"
    },
    {
      "seq": "1821",
      "time": "2022-06-27T03:22:27.000Z",
      "content": "Does the audience that he mentions (verse 3) make a difference to our understanding of his teaching? https://bookofmormon.online/downfall/48"
    },
    {
      "seq": "909",
      "time": "2022-06-27T10:13:53.000Z",
      "content": "This verse suggests that testimony has a saving power not only in heavenly things but also in temporal things. How can that be? https://bookofmormon.online/reign-of-judges/49"
    },
    {
      "seq": "1122",
      "time": "2022-06-27T17:05:19.000Z",
      "content": "How is what he says here relevant to his own experience? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/10"
    },
    {
      "seq": "1495",
      "time": "2022-06-27T23:56:45.000Z",
      "content": "Compare this verse to Isaiah 61:2. https://bookofmormon.online/jesus/66"
    },
    {
      "seq": "1355",
      "time": "2022-06-28T06:48:10.000Z",
      "content": "What day is Nephi referring to? https://bookofmormon.online/nephi/10"
    },
    {
      "seq": "1201",
      "time": "2022-06-28T13:39:36.000Z",
      "content": "Does Alma understand what the ultimate purpose of the Book of Mormon will be? If not, why not? What might your answer to that question suggest about our understanding of things? https://bookofmormon.online/reign-of-judges/helaman/14"
    },
    {
      "seq": "1739",
      "time": "2022-06-28T20:31:02.000Z",
      "content": "What does it mean to be wise in the days of our probation? https://bookofmormon.online/moroni/29"
    },
    {
      "seq": "1247",
      "time": "2022-06-29T03:22:27.000Z",
      "content": "Why would our souls be miserable if they were cut off from the Father? https://bookofmormon.online/reign-of-judges/corianton/33"
    },
    {
      "seq": "174",
      "time": "2022-06-29T10:13:53.000Z",
      "content": "What does it mean to be justified? What does justification have to do with justice? Is it relevant that both words have the same root? https://bookofmormon.online/promised-land/lehi/20"
    },
    {
      "seq": "829",
      "time": "2022-06-29T17:05:19.000Z",
      "content": "Why do Alma and Mosiah each seem to shirk judging the people who have been brought before them? https://bookofmormon.online/zarahemla/54"
    },
    {
      "seq": "1176",
      "time": "2022-06-29T23:56:45.000Z",
      "content": "Why does the explicit reference to mercy occur at the center of the prayer rather than at the end? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/33"
    },
    {
      "seq": "1075",
      "time": "2022-06-30T06:48:10.000Z",
      "content": "How is Alma’s missionary experience related to his own history? https://bookofmormon.online/reign-of-judges/89"
    },
    {
      "seq": "315",
      "time": "2022-06-30T13:39:36.000Z",
      "content": "What are the crosses of the world? Who are those who have endured those crosses? Does this verse and those that follow have any connection to the passage from Isaiah that Jacob read? https://bookofmormon.online/jacobs-sermon/28"
    },
    {
      "seq": "154",
      "time": "2022-06-30T20:31:02.000Z",
      "content": "What is promised here? How does this compare to what Nephi said in 1 Nephi 19:15? https://bookofmormon.online/brass-plates/13"
    },
    {
      "seq": "1489",
      "time": "2022-07-01T03:22:27.000Z",
      "content": "Why are those who have not seen and heard more blessed than those who have? https://bookofmormon.online/jesus/50"
    },
    {
      "seq": "1831",
      "time": "2022-07-01T10:13:53.000Z",
      "content": "When Moroni says, “I would exhort you that ye deny not the power of God,” what denial of God’s power does he seem to have in mind? How would what he has in mind be a denial of God’s power? https://bookofmormon.online/moroni/103"
    },
    {
      "seq": "1574",
      "time": "2022-07-01T17:05:19.000Z",
      "content": "What are the commandments Jesus has given? How are those commandments a response to the disputations that have been among the Nephites? (What disputations have we seen among them?) https://bookofmormon.online/jesus/145"
    },
    {
      "seq": "216",
      "time": "2022-07-01T23:56:45.000Z",
      "content": "When Lehi began, he was speaking to Jacob. Now he is speaking to all of his sons (compare verse 30). How would you explain that? https://bookofmormon.online/promised-land/lehi/40"
    },
    {
      "seq": "1760",
      "time": "2022-07-02T06:48:10.000Z",
      "content": "Has this verse been fulfilled yet? If not, when will it be fulfilled? What would its fulfillment entail? https://bookofmormon.online/moroni/44"
    },
    {
      "seq": "1034",
      "time": "2022-07-02T13:39:36.000Z",
      "content": "Ammon knows what has happened to Lamoni. Why does he wait so long to act? https://bookofmormon.online/ammon/58"
    },
    {
      "seq": "273",
      "time": "2022-07-02T20:31:02.000Z",
      "content": "There are two interpretations of these verses. According to one, the Lord is speaking; according to the other, Isaiah is speaking. What do we learn from each interpretation? https://bookofmormon.online/jacobs-sermon/10"
    },
    {
      "seq": "812",
      "time": "2022-07-03T03:22:27.000Z",
      "content": "Alma baptizes them so they can covenant to serve and obey the Lord and so the Lord can pour out his Spirit on them. Why can’t/won’t the Lord pour out his Spirit on them if they aren’t baptized? https://bookofmormon.online/alma/4"
    },
    {
      "seq": "599",
      "time": "2022-07-03T10:13:53.000Z",
      "content": "Why does Benjamin remind them that he too suffers infirmities of body and mind? https://bookofmormon.online/benjamin/4"
    },
    {
      "seq": "191",
      "time": "2022-07-03T17:05:19.000Z",
      "content": "What does opposition mean, “contrariety” or “difference”? My dictionary says that in the nineteenth century one of the meanings of opposition was “contrast.” Could that be the meaning here? Does that change our understanding of the verse? https://bookofmormon.online/promised-land/lehi/26"
    },
    {
      "seq": "1299",
      "time": "2022-07-03T23:56:45.000Z",
      "content": "What was Gadianton’s craft? Why is it important that he was expert not only in that craft but also “in many words”? https://bookofmormon.online/gadianton/2"
    },
    {
      "seq": "1649",
      "time": "2022-07-04T06:48:10.000Z",
      "content": "What does it mean to say that those who repent and are baptized will be filled? Does it have to do with having our hunger satisfied? Or are we missing something that is given with repentance and baptism? https://bookofmormon.online/jesus/220"
    },
    {
      "seq": "317",
      "time": "2022-07-04T13:39:36.000Z",
      "content": "Does this prophecy help us understand better the promises made to Israel by Isaiah? https://bookofmormon.online/jacobs-sermon/29"
    },
    {
      "seq": "1142",
      "time": "2022-07-04T20:31:02.000Z",
      "content": "How does one cast out the seed? What does that suggest about unbelief? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/16"
    },
    {
      "seq": "1474",
      "time": "2022-07-05T03:22:27.000Z",
      "content": "What bitter cup did the Father give him? Why does he describe it in those terms here? Is the metaphor he uses important? https://bookofmormon.online/jesus/43"
    },
    {
      "seq": "379",
      "time": "2022-07-05T10:13:53.000Z",
      "content": "How does the reference to the miracle of the bronze serpents on Moses’s staff serve as a testimony that what Nephi has said is true? https://bookofmormon.online/nephis-teachings/9"
    },
    {
      "seq": "176",
      "time": "2022-07-05T17:05:19.000Z",
      "content": "What is Lehi referring to when he says “that which is good”? If he means “the presence of the Father,” why does he not state it that way? https://bookofmormon.online/promised-land/lehi/20"
    },
    {
      "seq": "522",
      "time": "2022-07-05T23:56:45.000Z",
      "content": "Why is it important that his listeners remember their weaknesses? What might that say to us about our weaknesses and problems? https://bookofmormon.online/land-of-nephi/20"
    },
    {
      "seq": "447",
      "time": "2022-07-06T06:48:10.000Z",
      "content": "How do these verses define enduring to the end? What circumstances might have been the catalyst for Nephi’s emphasis on being baptized because Christ was? https://bookofmormon.online/nephis-testimony/7"
    },
    {
      "seq": "1652",
      "time": "2022-07-06T13:39:36.000Z",
      "content": "Is this the only commandment? If not, why does Jesus use such a specific form, this? https://bookofmormon.online/jesus/221"
    },
    {
      "seq": "42",
      "time": "2022-07-06T20:31:02.000Z",
      "content": "What has Nephi seen so far? When he asks for “the interpretation thereof,” what does he want to have explained for him? As you read the interpretation, compare it to what Lehi says about the tree ( 1 Nephi 8:11–12). https://bookofmormon.online/lehites/nephis-vision/6"
    },
    {
      "seq": "1601",
      "time": "2022-07-07T03:22:27.000Z",
      "content": "What does it literally mean that the daughters of Jerusalem have sold themselves for naught? What does it mean figuratively? What does it literally mean that they will be redeemed without money? What does it mean figuratively? https://bookofmormon.online/jesus-teachings/19"
    },
    {
      "seq": "1447",
      "time": "2022-07-07T10:13:53.000Z",
      "content": "In this case does the word then mean that they will know their Redeemer after they know the covenant the Lord has made with Israel, or does it mean that they will know their Redeemer in knowing that covenant? https://bookofmormon.online/mormon/54"
    },
    {
      "seq": "1318",
      "time": "2022-07-07T17:05:19.000Z",
      "content": "How do the righteous among the Nephites handle the persecutions? What might that say to us? https://bookofmormon.online/gadianton/22"
    },
    {
      "seq": "431",
      "time": "2022-07-07T23:56:45.000Z",
      "content": "A common meaning of plain is “unornamented.” However, Webster’s 1828 dictionary also gives “honesty” as one of its meanings. Is that meaning part of what Nephi intends with the word? If you say yes, what makes you think so? https://bookofmormon.online/nephis-testimony/2"
    },
    {
      "seq": "297",
      "time": "2022-07-08T06:48:10.000Z",
      "content": "In verses 21–23 we see that the oppressors will become the oppressed. Who are the oppressors? Who will oppress them? How? https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "1540",
      "time": "2022-07-08T13:39:36.000Z",
      "content": "What is Jesus teaching here? When would we be giving holy things to the dogs or casting our pearls before swine? How do we avoid doing so? https://bookofmormon.online/jesus/93"
    },
    {
      "seq": "691",
      "time": "2022-07-08T20:31:02.000Z",
      "content": "They say they could prophesy of all things if it were expedient. What does it mean to prophesy of all things? Why is that important? What does it mean to prophesy, beyond foretelling the future? https://bookofmormon.online/benjamin/91"
    },
    {
      "seq": "919",
      "time": "2022-07-09T03:22:27.000Z",
      "content": "What does “receive his image in your countenances” mean? Does it have anything to do with Genesis 1:27: “God created man in his own image, in the image of God created he him; male and female created he them”? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/9"
    },
    {
      "seq": "1717",
      "time": "2022-07-09T10:13:53.000Z",
      "content": "What kinds of pollution is Moroni thinking of here? Is it the list that follows, or does it include more than that? https://bookofmormon.online/moroni/13"
    },
    {
      "seq": "1261",
      "time": "2022-07-09T17:05:19.000Z",
      "content": "Are the people of Ammon (the Anti-Nephi-Lehies) being fair to the Nephites? Why don’t the Nephites demand their help in the battles against the Lamanites? https://bookofmormon.online/war/4"
    },
    {
      "seq": "1350",
      "time": "2022-07-09T23:56:45.000Z",
      "content": "What are the two groups against whom the Gadiantons act? https://bookofmormon.online/gadianton/90"
    },
    {
      "seq": "862",
      "time": "2022-07-10T06:48:10.000Z",
      "content": "As you think about the story of Alma’s conversion, think about the difference between his experience before an angel and Laman and Lemuel’s experience before one. Why do we have such a dramatic difference between the results of the two? https://bookofmormon.online/zarahemla/79"
    },
    {
      "seq": "1570",
      "time": "2022-07-10T13:39:36.000Z",
      "content": "What does it mean to watch and pray lest we enter into temptation? https://bookofmormon.online/jesus/136"
    },
    {
      "seq": "1515",
      "time": "2022-07-10T20:31:02.000Z",
      "content": "What do these verses teach us about how we should respond to the demands of those who oppress us? Compare verse 42 to Mosiah 4:16–23. What obligation is Jesus giving us in verse 42? https://bookofmormon.online/jesus/76"
    },
    {
      "seq": "699",
      "time": "2022-07-11T03:22:27.000Z",
      "content": "Lehi says we all have agency, so in what way are these people now free that they weren’t before? https://bookofmormon.online/benjamin/94"
    },
    {
      "seq": "422",
      "time": "2022-07-11T10:13:53.000Z",
      "content": "Why do we sometimes anger at that which is good? How do we justify such anger to ourselves and others? https://bookofmormon.online/nephis-teachings/46"
    },
    {
      "seq": "1809",
      "time": "2022-07-11T17:05:19.000Z",
      "content": "Does this verse answer the question about verse 1, or does it add additional qualifications? Does the word neither at the beginning of the verse suggest an answer to that question? https://bookofmormon.online/moroni/95"
    },
    {
      "seq": "643",
      "time": "2022-07-11T23:56:45.000Z",
      "content": "What is the fear of the Lord? Are King Benjamin’s people afraid that the punishments he has described in verses 25–27 of chapter 3 will come upon them? How so if they are the diligent people Benjamin said they were in Mosiah 1:11? https://bookofmormon.online/benjamin/59"
    },
    {
      "seq": "982",
      "time": "2022-07-12T06:48:10.000Z",
      "content": "What does “they shall not impart only according to the portion of his word which he doth grant unto the children of men, according to the heed and diligence which they give unto him” mean in contemporary, ordinary English? https://bookofmormon.online/reign-of-judges/ammonihah/86"
    },
    {
      "seq": "682",
      "time": "2022-07-12T13:39:36.000Z",
      "content": "All these things must be done in order. All what things? To what does this admonition refer—to caring for the needy? To other things as well? https://bookofmormon.online/benjamin/86"
    },
    {
      "seq": "227",
      "time": "2022-07-12T20:31:02.000Z",
      "content": "What is “the promise of Moses”? https://bookofmormon.online/promised-land/lehi/60"
    },
    {
      "seq": "1178",
      "time": "2022-07-13T03:22:27.000Z",
      "content": "Why has Alma waited until this point in his sermon to appeal to the authority of scripture? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/43"
    },
    {
      "seq": "566",
      "time": "2022-07-13T10:13:53.000Z",
      "content": "What does it mean to be whole? https://bookofmormon.online/land-of-nephi/31"
    },
    {
      "seq": "106",
      "time": "2022-07-13T17:05:19.000Z",
      "content": "What is the world like for those who are members of the church of the Lamb of God? https://bookofmormon.online/lehites/nephis-vision/50"
    },
    {
      "seq": "1141",
      "time": "2022-07-13T23:56:45.000Z",
      "content": "Why would Alma describe the word as delicious? What does that suggest? Why does he say that the soul begins to be enlarged, the understanding begins to be enlightened, and the seed begins to be delicious? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/16"
    },
    {
      "seq": "234",
      "time": "2022-07-14T06:48:10.000Z",
      "content": "Is this a reasonable outline of these verses? https://bookofmormon.online/promised-land/44"
    },
    {
      "seq": "1012",
      "time": "2022-07-14T13:39:36.000Z",
      "content": "Against what is Alma warning them in this verse? Can we connect the sermon that follows this verse with his sermon on the priesthood? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "695",
      "time": "2022-07-14T20:31:02.000Z",
      "content": "What does King Benjamin mean when he says this is a righteous covenant? https://bookofmormon.online/benjamin/92"
    },
    {
      "seq": "184",
      "time": "2022-07-15T03:22:27.000Z",
      "content": "Why is the Savior said to be the firstfruits? Notice that in the Old Testament, the word is mostly used to describe the first grain or other produce to ripen. How is that description appropriate? Is it related to his title of Firstborn? https://bookofmormon.online/promised-land/lehi/23"
    },
    {
      "seq": "567",
      "time": "2022-07-15T10:13:53.000Z",
      "content": "When the Lord says that Enos has “never before” seen or heard Christ, does that suggest that he now has? https://bookofmormon.online/land-of-nephi/31"
    },
    {
      "seq": "1589",
      "time": "2022-07-15T17:05:19.000Z",
      "content": "Did they perhaps receive their endowment? What would justify your answer? https://bookofmormon.online/jesus/165"
    },
    {
      "seq": "853",
      "time": "2022-07-15T23:56:45.000Z",
      "content": "What do the scriptures tell us it means to be a son or daughter of God? How is that related to the doctrine that we are the literal spiritual offspring of God? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "53",
      "time": "2022-07-16T06:48:10.000Z",
      "content": "Why does Nephi add, “I do not know the meaning of all things”? Since no human being does, that is a strange thing to say. https://bookofmormon.online/lehites/nephis-vision/9"
    },
    {
      "seq": "200",
      "time": "2022-07-16T13:39:36.000Z",
      "content": "The first part of the verse answers the string of if-then statements in 13: Verse 13 says “if this, then not that,” and so on. Verse 14 says “but that is true.” It follows that the first this in verse 13 isn’t true. https://bookofmormon.online/promised-land/lehi/31"
    },
    {
      "seq": "374",
      "time": "2022-07-16T20:31:02.000Z",
      "content": "What would it mean to be “taught after the manner of the things of the Jews”? Has Nephi been so taught? Jacob? Nephi’s people? https://bookofmormon.online/nephis-teachings/3"
    },
    {
      "seq": "1293",
      "time": "2022-07-17T03:22:27.000Z",
      "content": "How do we understand a righteous person like Pahoran the elder having a child who was so unrighteous? https://bookofmormon.online/war/144"
    },
    {
      "seq": "1126",
      "time": "2022-07-17T10:13:53.000Z",
      "content": "Interlude ( Alma 34) Before reading Alma’s teachings to the Zoramite poor, it might be helpful to read Alma 34:1–5, Amulek’s description of what Alma did. https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/12"
    },
    {
      "seq": "1114",
      "time": "2022-07-17T17:05:19.000Z",
      "content": "If even those who are humbled against their wills are blessed, why is it better to humble oneself? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/4"
    },
    {
      "seq": "1068",
      "time": "2022-07-17T23:56:45.000Z",
      "content": "What does Alma desire? https://bookofmormon.online/reign-of-judges/85"
    },
    {
      "seq": "54",
      "time": "2022-07-18T06:48:10.000Z",
      "content": "How is verse 18 related to the question of verse 16? https://bookofmormon.online/lehites/nephis-vision/9"
    },
    {
      "seq": "512",
      "time": "2022-07-18T13:39:36.000Z",
      "content": "What might verse 7 tell us about our own situation? What does Jacob mean when he says “their skins will be whiter than yours, when ye shall be brought with them before the throne of God” (verse 8)? Why does he fear that will be true? https://bookofmormon.online/promised-land/56"
    },
    {
      "seq": "1281",
      "time": "2022-07-18T20:31:02.000Z",
      "content": "What do we learn about the people of Ammon? What do we learn about Helaman? Why is he afraid they will lose their souls if they defend themselves? https://bookofmormon.online/war/west/1"
    },
    {
      "seq": "1637",
      "time": "2022-07-19T03:22:27.000Z",
      "content": "Why might the things they heard be unlawful to speak? https://bookofmormon.online/jesus/210"
    },
    {
      "seq": "1416",
      "time": "2022-07-19T10:13:53.000Z",
      "content": "Why does the prophet give them a sign? https://bookofmormon.online/samuel/29"
    },
    {
      "seq": "457",
      "time": "2022-07-19T17:05:19.000Z",
      "content": "About what are Nephi’s listeners pondering? Why do you think they might be doing so? https://bookofmormon.online/nephis-testimony/14"
    },
    {
      "seq": "1375",
      "time": "2022-07-19T23:56:45.000Z",
      "content": "Why won’t Nephi ask that which is contrary to the Lord’s will? https://bookofmormon.online/nephi/55"
    },
    {
      "seq": "107",
      "time": "2022-07-20T06:48:10.000Z",
      "content": "What is the promise to them? https://bookofmormon.online/lehites/nephis-vision/51"
    },
    {
      "seq": "1842",
      "time": "2022-07-20T13:39:36.000Z",
      "content": "What kind of mood does Moroni exhibit in this verse? So what? https://bookofmormon.online/moroni/118"
    },
    {
      "seq": "1659",
      "time": "2022-07-20T20:31:02.000Z",
      "content": "Does “these sayings” refer to what Mormon has just said, to the sermons Christ has just preached among the Nephites, or to the entire Book of Mormon? How would we decide? https://bookofmormon.online/mormon/69"
    },
    {
      "seq": "43",
      "time": "2022-07-21T03:22:27.000Z",
      "content": "Nephi identifies the Spirit as the Spirit of the Lord. Does that phrase refer to the Holy Ghost or to the Son? https://bookofmormon.online/lehites/nephis-vision/6"
    },
    {
      "seq": "1395",
      "time": "2022-07-21T10:13:53.000Z",
      "content": "Can there be good works without repentance? Repentance without good works? https://bookofmormon.online/mormon/42"
    },
    {
      "seq": "1264",
      "time": "2022-07-21T17:05:19.000Z",
      "content": "Why does Alma feel he must defend Moroni’s use of “stratagem”? What do we learn about the Nephites from this? Does it suggest anything about our own behavior in war? Why or why not? https://bookofmormon.online/war/13"
    },
    {
      "seq": "847",
      "time": "2022-07-21T23:56:45.000Z",
      "content": "Why is that type so important for Alma the Younger? In what ways it is important to our understanding of the gospel? To our understanding of our own lives? https://bookofmormon.online/zarahemla/71"
    },
    {
      "seq": "506",
      "time": "2022-07-22T06:48:10.000Z",
      "content": "What does it mean to lift up our heads? https://bookofmormon.online/jacobs-address/14"
    },
    {
      "seq": "479",
      "time": "2022-07-22T13:39:36.000Z",
      "content": "What does Jacob imply when he says that the Nephites began to “indulge themselves somewhat in wicked practices” (verse 15)? Does Jacob 2:5 throw any light on this? https://bookofmormon.online/land-of-nephi/13"
    },
    {
      "seq": "1050",
      "time": "2022-07-22T20:31:02.000Z",
      "content": "As we have it, this verse equates being righteous with laying down their weapons. Why? Is Alma 26:32 relevant? https://bookofmormon.online/aaron/40"
    },
    {
      "seq": "1149",
      "time": "2022-07-23T03:22:27.000Z",
      "content": "Why might Alma have felt the need to address the question of whether the word is real? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/22"
    },
    {
      "seq": "1775",
      "time": "2022-07-23T10:13:53.000Z",
      "content": "Ether says that those who believe can hope for a better world. Is he referring only to the “next world”? Is the answer to our present sorrows “Don’t worry, it will be better later,” or does the gospel change this world as well? https://bookofmormon.online/jaredites/151"
    },
    {
      "seq": "476",
      "time": "2022-07-23T17:05:19.000Z",
      "content": "What might it mean that Nephi has “wielded the sword of Laban” to defend his people? When might that have happened? https://bookofmormon.online/land-of-nephi/11"
    },
    {
      "seq": "1150",
      "time": "2022-07-23T23:56:45.000Z",
      "content": "Earlier (verses 28 and 34) Alma spoke of the word enlightening our understanding. Is this a continuation of that point? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/22"
    },
    {
      "seq": "327",
      "time": "2022-07-24T06:48:10.000Z",
      "content": "What does it mean to die in one’s sins? How do we avoid that? https://bookofmormon.online/jacobs-sermon/34"
    },
    {
      "seq": "427",
      "time": "2022-07-24T13:39:36.000Z",
      "content": "What does the word doctrine mean? https://bookofmormon.online/nephis-testimony/2"
    },
    {
      "seq": "1392",
      "time": "2022-07-24T20:31:02.000Z",
      "content": "Compare what Mormon says here with Mosiah 4:5–16. https://bookofmormon.online/mormon/37"
    },
    {
      "seq": "1403",
      "time": "2022-07-25T03:22:27.000Z",
      "content": "Why does he emphasize the fact that he is sparing Zarahemla for the righteous’ sake? https://bookofmormon.online/samuel/8"
    },
    {
      "seq": "1265",
      "time": "2022-07-25T10:13:53.000Z",
      "content": "This is the third time Alma has told us the reasons the Nephites are fighting (compare verses 9, 29–30). Why does he emphasize this? What application might what he says have for us? https://bookofmormon.online/war/19"
    },
    {
      "seq": "732",
      "time": "2022-07-25T17:05:19.000Z",
      "content": "Notice how Abinadi seems to come out of nowhere. He has been among them, but no mention is made of his family or of anything else about him. Why not? Why give him such a dramatic entrance? https://bookofmormon.online/recolonization/30"
    },
    {
      "seq": "1255",
      "time": "2022-07-25T23:56:45.000Z",
      "content": "Does this perhaps clarify why Alma has explained the doctrines of restoration, resurrection, and Atonement to Corianton? What does it seem Corianton has been thinking? https://bookofmormon.online/reign-of-judges/corianton/40"
    },
    {
      "seq": "1263",
      "time": "2022-07-26T06:48:10.000Z",
      "content": "Moroni sends spies to watch the movements of the Lamanites and messengers to ask the prophet. Why both? Why not just one or the other? https://bookofmormon.online/war/10"
    },
    {
      "seq": "1209",
      "time": "2022-07-26T13:39:36.000Z",
      "content": "What are the affections of our hearts? What does it mean to place our affections on the Lord? https://bookofmormon.online/reign-of-judges/helaman/24"
    },
    {
      "seq": "760",
      "time": "2022-07-26T20:31:02.000Z",
      "content": "When he says they are quick to do iniquity and slow to remember the Lord, does he say anything about why a strict law is required? https://bookofmormon.online/recolonization/abinadi/16"
    },
    {
      "seq": "1432",
      "time": "2022-07-27T03:22:27.000Z",
      "content": "Once again the people have repented after having to defend themselves against an enemy. Why does Mormon insert his commentary here? https://bookofmormon.online/gadianton/163"
    },
    {
      "seq": "1561",
      "time": "2022-07-27T10:13:53.000Z",
      "content": "What does Christ mean when, in verse 20, he says his joy is full? What makes it full? https://bookofmormon.online/jesus/118"
    },
    {
      "seq": "792",
      "time": "2022-07-27T17:05:19.000Z",
      "content": "To whom is Abinadi speaking when he says “ye ought to tremble”? https://bookofmormon.online/recolonization/abinadi/45"
    },
    {
      "seq": "73",
      "time": "2022-07-27T23:56:45.000Z",
      "content": "Why does the angel describe the occupants of the building as the house of Israel (verse 35)? Don’t the events to which this corresponds occur after the loss of the ten tribes? https://bookofmormon.online/lehites/nephis-vision/19"
    },
    {
      "seq": "1456",
      "time": "2022-07-28T06:48:10.000Z",
      "content": "Why might there have been so much destruction in this hemisphere at the time of the crucifixion and so little destruction in the other hemisphere? https://bookofmormon.online/jesus/1"
    },
    {
      "seq": "1391",
      "time": "2022-07-28T13:39:36.000Z",
      "content": "What is the point of these verses? In context, what are they to teach us? https://bookofmormon.online/mormon/37"
    },
    {
      "seq": "433",
      "time": "2022-07-28T20:31:02.000Z",
      "content": "Given the highly figured language in works such as Isaiah and Jeremiah, and the importance of types in the Old Testament as well as the Book of Mormon, how can Nephi say that the Lord works plainly? https://bookofmormon.online/nephis-testimony/2"
    },
    {
      "seq": "603",
      "time": "2022-07-29T03:22:27.000Z",
      "content": "Notice how Benjamin shifts from his service to thanks to God by focusing on service and kingship: If you owe me thanks for the service I’ve wrought as king, just think of the thanks you owe the Heavenly King. https://bookofmormon.online/benjamin/10"
    },
    {
      "seq": "93",
      "time": "2022-07-29T10:13:53.000Z",
      "content": "To what does “other books” refer? To Restoration scripture? https://bookofmormon.online/lehites/nephis-vision/44"
    },
    {
      "seq": "1256",
      "time": "2022-07-29T17:05:19.000Z",
      "content": "How do we let the justice and mercy of God have full sway in our hearts? What does that mean? https://bookofmormon.online/reign-of-judges/corianton/40"
    },
    {
      "seq": "1044",
      "time": "2022-07-29T23:56:45.000Z",
      "content": "How does Lamoni’s father understand what it means to be born again? Can you explain what this means in practical, concrete terms? https://bookofmormon.online/aaron/26"
    },
    {
      "seq": "721",
      "time": "2022-07-30T06:48:10.000Z",
      "content": "Why do you think the Book of Mormon writers gave us this part of the book? We can easily see why we need the clearly doctrinal portions, like Benjamin’s sermon. But why do we need the story part of the book? https://bookofmormon.online/zarahemla/34"
    },
    {
      "seq": "1413",
      "time": "2022-07-30T13:39:36.000Z",
      "content": "Not only have their riches become slippery, but all things have. What does that mean? https://bookofmormon.online/samuel/25"
    },
    {
      "seq": "851",
      "time": "2022-07-30T20:31:02.000Z",
      "content": "What does it mean to repent? What does the word redeemed mean? What does it mean to be redeemed by the Lord? What does it mean to be born of the Spirit? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "275",
      "time": "2022-07-31T03:22:27.000Z",
      "content": "How would this speech, a speech of consolation to Israel, be an appropriate thing for Jacob to repeat to the Nephites at the time of Nephi? Later? To us? https://bookofmormon.online/jacobs-sermon/12"
    },
    {
      "seq": "632",
      "time": "2022-07-31T10:13:53.000Z",
      "content": "Benjamin says that the Lord showed the Israelites many signs, wonders, types, and shadows. What are each of these, particularly types and shadows? https://bookofmormon.online/benjamin/47"
    },
    {
      "seq": "1260",
      "time": "2022-07-31T17:05:19.000Z",
      "content": "What additional circumstance might justify war? https://bookofmormon.online/war/4"
    },
    {
      "seq": "1006",
      "time": "2022-07-31T23:56:45.000Z",
      "content": "Alma says those who have been purified cannot look on sin except with abhorrence. What does that mean? Does it have anything to do with Mosiah 5:2? If a pure person abhors sin, how does he or she feel about those in sin? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1827",
      "time": "2022-08-01T06:48:10.000Z",
      "content": "What does it mean to us that the words that follow (up to verse 23) are specifically directed to the Lamanites? What is Moroni’s interest in them? https://bookofmormon.online/moroni/100"
    },
    {
      "seq": "1393",
      "time": "2022-08-01T13:39:36.000Z",
      "content": "What does he mean by God’s “great fulness”? https://bookofmormon.online/mormon/42"
    },
    {
      "seq": "715",
      "time": "2022-08-01T20:31:02.000Z",
      "content": "Why does the writer mention that the Father is the Creator? What has that to do with the subject of this verse? https://bookofmormon.online/benjamin/101"
    },
    {
      "seq": "1168",
      "time": "2022-08-02T03:22:27.000Z",
      "content": "Why does faith require both diligence and patience? In the end, what is the point of the experiment on the word? What does Amulek identify as the point ( Alma 34:3)? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/28"
    },
    {
      "seq": "630",
      "time": "2022-08-02T10:13:53.000Z",
      "content": "Why does Benjamin say that salvation comes only to those who repent and have faith? Since they are necessary, why doesn’t he mention works or ordinances? https://bookofmormon.online/benjamin/44"
    },
    {
      "seq": "530",
      "time": "2022-08-02T17:05:19.000Z",
      "content": "If someone has rejected the only stone that could be their foundation, how can it become that foundation? (Compare Romans 11.) https://bookofmormon.online/olive-tree/10"
    },
    {
      "seq": "312",
      "time": "2022-08-02T23:56:45.000Z",
      "content": "What kind of symbolism do you see in the contrast between guilt, uncleanness, and nakedness on the one hand and enjoyment and the clothing of purity and the robe of righteousness on the other hand? https://bookofmormon.online/jacobs-sermon/26"
    },
    {
      "seq": "423",
      "time": "2022-08-03T06:48:10.000Z",
      "content": "In what ways might we be pacified in Zion? https://bookofmormon.online/nephis-teachings/47"
    },
    {
      "seq": "1366",
      "time": "2022-08-03T13:39:36.000Z",
      "content": "Why would the story of Moses and Israel be such a powerful example for Nephi? Why might the accusation that they deny Moses’s words be such a powerful accusation? https://bookofmormon.online/nephi/22"
    },
    {
      "seq": "839",
      "time": "2022-08-03T20:31:02.000Z",
      "content": "This verse says that Alma was idolatrous. What does that mean? Does Mosiah 28:4 explain this remark? https://bookofmormon.online/zarahemla/68"
    },
    {
      "seq": "1593",
      "time": "2022-08-04T03:22:27.000Z",
      "content": "When will the conditions described here occur? https://bookofmormon.online/jesus/112"
    },
    {
      "seq": "470",
      "time": "2022-08-04T10:13:53.000Z",
      "content": "What does Jacob’s use of persuade suggest? What does it mean “to partake of the goodness of God”? How do we partake, in other words, share in that goodness? https://bookofmormon.online/land-of-nephi/10"
    },
    {
      "seq": "10",
      "time": "2022-08-04T17:05:19.000Z",
      "content": "Did Nephi initially believe his father’s visions? If so, then what does it mean that his heart was softened, and why was he “crying unto the Lord”? https://bookofmormon.online/lehites/17"
    },
    {
      "seq": "1585",
      "time": "2022-08-04T23:56:45.000Z",
      "content": "What does it mean that “they were filled with desire”? Desire for what? https://bookofmormon.online/jesus/161"
    },
    {
      "seq": "751",
      "time": "2022-08-05T06:48:10.000Z",
      "content": "Look carefully at what Abinadi says here: 1. If you have understood these things, you haven’t taught them. 2. So you have perverted the way of the Lord. 3. You haven’t applied your hearts to understanding. 4. So what have you taught? https://bookofmormon.online/recolonization/38"
    },
    {
      "seq": "1412",
      "time": "2022-08-05T13:39:36.000Z",
      "content": "They seem to be saying, “If only we had repented, we would still be rich.” Is this a portrayal of genuine repentance? If not, why is it part of the record? https://bookofmormon.online/samuel/25"
    },
    {
      "seq": "713",
      "time": "2022-08-05T20:31:02.000Z",
      "content": "What does the word salvation mean in this context? What is eternal life? https://bookofmormon.online/benjamin/101"
    },
    {
      "seq": "1510",
      "time": "2022-08-06T03:22:27.000Z",
      "content": "Jesus is obviously speaking hyperbolically. What is the point of his hyperbole? Does he here give us a definition of what it means to take up one’s cross? https://bookofmormon.online/jesus/73"
    },
    {
      "seq": "1076",
      "time": "2022-08-06T10:13:53.000Z",
      "content": "How is Alma’s missionary experience related to the experience of his ancestors? Is there a common theme in these three events: the conversion of the Lamanites, Alma’s conversion, and the history of Alma’s ancestors? https://bookofmormon.online/reign-of-judges/90"
    },
    {
      "seq": "850",
      "time": "2022-08-06T17:05:19.000Z",
      "content": "Notice that “after two days and two nights” means the same as “on the third day.” What is the significance of rising on the third day? What does it mean to be of good comfort? What does the word comfort mean in this context? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "1721",
      "time": "2022-08-06T23:56:45.000Z",
      "content": "What are “these things” that he promises will be fulfilled? https://bookofmormon.online/moroni/14"
    },
    {
      "seq": "247",
      "time": "2022-08-07T06:48:10.000Z",
      "content": "What does it mean to be encircled in the robes of the Lord’s righteousness? (Compare Isaiah 61:10 and Baruch 5:2. Baruch is in the Apocrypha.) What surrounded Nephi in verse 18? https://bookofmormon.online/promised-land/50"
    },
    {
      "seq": "1704",
      "time": "2022-08-07T13:39:36.000Z",
      "content": "Why must the remnant know that they are of the house of Israel? https://bookofmormon.online/mormon/91"
    },
    {
      "seq": "285",
      "time": "2022-08-07T20:31:02.000Z",
      "content": "Who is calling out “Awake!” (verse 9)? Who is being addressed? Do verses 10–11 explain the references in verse 9? https://bookofmormon.online/jacobs-sermon/15"
    },
    {
      "seq": "838",
      "time": "2022-08-08T03:22:27.000Z",
      "content": "Does this explain at least some of what it means to not persecute and to be equal? https://bookofmormon.online/zarahemla/66"
    },
    {
      "seq": "1217",
      "time": "2022-08-08T10:13:53.000Z",
      "content": "What sins is Corianton guilty of? I suggest that you make a list of the sins that Alma mentions. https://bookofmormon.online/reign-of-judges/corianton/1"
    },
    {
      "seq": "880",
      "time": "2022-08-08T17:05:19.000Z",
      "content": "In the Old Testament the king is often understood as a shadow of the Messiah, one for whom the Savior is the type. Is Mosiah suggesting here that, because of our iniquity, that parallel doesn’t work? https://bookofmormon.online/zarahemla/96"
    },
    {
      "seq": "1083",
      "time": "2022-08-08T23:56:45.000Z",
      "content": "Korihor says that their anticipation of forgiveness is “the effect of a frenzied [i.e., mad] mind.” What does he mean by that phrase? Of what is he accusing them? https://bookofmormon.online/reign-of-judges/korihor/3"
    },
    {
      "seq": "857",
      "time": "2022-08-09T06:48:10.000Z",
      "content": "What is gall? What is “the gall of bitterness”? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "1836",
      "time": "2022-08-09T13:39:36.000Z",
      "content": "To whom does Moroni now turn? Why does he turn to them last? https://bookofmormon.online/moroni/115"
    },
    {
      "seq": "1444",
      "time": "2022-08-09T20:31:02.000Z",
      "content": "Notice the repetition of surely. Does its use in verse 24 suggest something about the way in which it was being used earlier? https://bookofmormon.online/mormon/52"
    },
    {
      "seq": "1801",
      "time": "2022-08-10T03:22:27.000Z",
      "content": "Moroni intended to end the Book of Mormon with his abridgment of Ether. Why do you think he intended that? What would have made Ether an appropriate end to Moroni’s record? https://bookofmormon.online/moroni/90"
    },
    {
      "seq": "533",
      "time": "2022-08-10T10:13:53.000Z",
      "content": "In an effort to save the tree, the master commands his servant to bring wild olive branches to be grafted in, and he says the old branches will be burned. https://bookofmormon.online/olive-tree/5"
    },
    {
      "seq": "401",
      "time": "2022-08-10T17:05:19.000Z",
      "content": "In what sense is the gospel a free gift? Why might Nephi have been reminded of Isaiah’s phrase in this context? How is the theme of these verses related to the last part of verse 20? https://bookofmormon.online/nephis-teachings/22"
    },
    {
      "seq": "248",
      "time": "2022-08-10T23:56:45.000Z",
      "content": "Is there a significant difference between faith in God and trust in God? What does it mean to trust in the arm of flesh? When might we find ourselves doing that? https://bookofmormon.online/promised-land/51"
    },
    {
      "seq": "1039",
      "time": "2022-08-11T06:48:10.000Z",
      "content": "What argument do the Amalekites make against Aaron? Can you state that argument in contemporary terms? How does Aaron respond? Can you state his response in contemporary terms? https://bookofmormon.online/aaron/1"
    },
    {
      "seq": "716",
      "time": "2022-08-11T13:39:36.000Z",
      "content": "Why did Benjamin record the names of all those who entered the covenant? https://bookofmormon.online/zarahemla/33"
    },
    {
      "seq": "1341",
      "time": "2022-08-11T20:31:02.000Z",
      "content": "Does Moroni’s way of fighting war teach us anything about our own wars? What? https://bookofmormon.online/gadianton/69"
    },
    {
      "seq": "1286",
      "time": "2022-08-12T03:22:27.000Z",
      "content": "When, in verse 20, Moroni asks, “Have ye forgotten the captivity of our fathers?” who are the fathers to whom he is referring? Is he thinking in terms of types and shadows, of Moses and Israel, for example? https://bookofmormon.online/war/east/70"
    },
    {
      "seq": "1253",
      "time": "2022-08-12T10:13:53.000Z",
      "content": "How does this verse fit with Alma’s teaching about restoration in chapter 41? https://bookofmormon.online/reign-of-judges/corianton/39"
    },
    {
      "seq": "240",
      "time": "2022-08-12T17:05:19.000Z",
      "content": "What things is Nephi grateful for? Can you draw specific parallels to the things we should be thankful for? Are these some of the “things of the Lord” mentioned in verse 16? https://bookofmormon.online/promised-land/47"
    },
    {
      "seq": "1521",
      "time": "2022-08-12T23:56:45.000Z",
      "content": "Can we be whole in this life? If not, then why has Jesus commanded us to be whole? https://bookofmormon.online/jesus/78"
    },
    {
      "seq": "1719",
      "time": "2022-08-13T06:48:10.000Z",
      "content": "In what ways do people get gain from churches? https://bookofmormon.online/moroni/14"
    },
    {
      "seq": "953",
      "time": "2022-08-13T13:39:36.000Z",
      "content": "How does what Alma says here correlate with what he told those of Zarahemla in Alma 5:6, 13–15, 27–30, and 53–55? How does it correlate with Mosiah 4? What themes recur in each of these sermons about salvation? https://bookofmormon.online/reign-of-judges/gideon/15"
    },
    {
      "seq": "162",
      "time": "2022-08-13T20:31:02.000Z",
      "content": "In the scriptures, what does it mean for a man to make his arm bare, that is, to reveal his arm? How does restoring his covenants make his arm bare? https://bookofmormon.online/promised-land/28"
    },
    {
      "seq": "1625",
      "time": "2022-08-14T03:22:27.000Z",
      "content": "This is the third time the Savior has made this prophecy during his appearance to the Nephites. Obviously he is emphasizing it. Why such emphasis? https://bookofmormon.online/jesus/188"
    },
    {
      "seq": "526",
      "time": "2022-08-14T10:13:53.000Z",
      "content": "Does this verse answer the question asked earlier about obtaining a hope in Christ ( Jacob 2:18–29)? https://bookofmormon.online/land-of-nephi/23"
    },
    {
      "seq": "204",
      "time": "2022-08-14T17:05:19.000Z",
      "content": "Why is the devil called “the father of all lies”? Why use the metaphor of fatherhood? What is the devil’s lie? (Compare what he tells Adam and Eve with Genesis 3:22 and Moses 4:28.) https://bookofmormon.online/promised-land/lehi/33"
    },
    {
      "seq": "773",
      "time": "2022-08-14T23:56:45.000Z",
      "content": "In verse 6 we are compared to sheep. In verse 7, the Savior is. But our comparison is negative, and Christ’s is positive. What might the use of sheep in both comparisons indicate? https://bookofmormon.online/recolonization/abinadi/24"
    },
    {
      "seq": "988",
      "time": "2022-08-15T06:48:10.000Z",
      "content": "Alma teaches here that life is the time given us to repent. How do we avoid a belief in original sin given these teachings? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/3"
    },
    {
      "seq": "402",
      "time": "2022-08-15T13:39:36.000Z",
      "content": "What is the point of these verses? Why are they formulated as rhetorical questions? Why are the messages of these verses important to us? https://bookofmormon.online/nephis-teachings/24"
    },
    {
      "seq": "1754",
      "time": "2022-08-15T20:31:02.000Z",
      "content": "The Lord tells him he is redeemed from the fall because he knows that God speaks the truth. Why would that redeem him? What does it mean to be redeemed from the fall? https://bookofmormon.online/jaredites/30"
    },
    {
      "seq": "1160",
      "time": "2022-08-16T03:22:27.000Z",
      "content": "If Alma had referred to the heat of the sun in verse 37, to what might he have been referring? Does it mean the same thing in verse 38? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "1583",
      "time": "2022-08-16T10:13:53.000Z",
      "content": "What does this mean for us? https://bookofmormon.online/jesus/160"
    },
    {
      "seq": "1667",
      "time": "2022-08-16T17:05:19.000Z",
      "content": "Does this verse mean that those who do not have all things in common are not partakers of the heavenly gift? https://bookofmormon.online/mormon/69"
    },
    {
      "seq": "783",
      "time": "2022-08-16T23:56:45.000Z",
      "content": "Why does Abinadi give them this explanation of the relation of the Father and the Son? https://bookofmormon.online/recolonization/abinadi/32"
    },
    {
      "seq": "1128",
      "time": "2022-08-17T06:48:10.000Z",
      "content": "Why does Amulek understand Alma’s sermon as preparatory, and why does he focus on Alma’s exhortation to faith and patience? Would you have noticed that exhortation in Alma’s sermon if Amulek hadn’t brought it out? Why or why not? https://bookofmormon.online/reign-of-judges/zoramites/16"
    },
    {
      "seq": "155",
      "time": "2022-08-17T13:39:36.000Z",
      "content": "What is promised here? To whom? https://bookofmormon.online/brass-plates/15"
    },
    {
      "seq": "95",
      "time": "2022-08-17T20:31:02.000Z",
      "content": "These verses are one long sentence. Here is a paraphrase and outline of them: https://bookofmormon.online/lehites/nephis-vision/46"
    },
    {
      "seq": "615",
      "time": "2022-08-18T03:22:27.000Z",
      "content": "In Mosiah 1:11, Benjamin said that his people had been diligent in keeping the commandments. Now he says he must rid his garments of their blood before he dies. Why is that necessary if they have been good people? https://bookofmormon.online/benjamin/21"
    },
    {
      "seq": "1326",
      "time": "2022-08-18T10:13:53.000Z",
      "content": "Is the description that follows (“they began to disbelieve in the spirit of prophecy and in the spirit of revelation”) something that happened in addition to dwindling, or does it repeat that they dwindled, using different words? https://bookofmormon.online/gadianton/33"
    },
    {
      "seq": "515",
      "time": "2022-08-18T17:05:19.000Z",
      "content": "What consequence of their sins does Jacob warn them of? How does that apply to us? https://bookofmormon.online/jacobs-address/17"
    },
    {
      "seq": "230",
      "time": "2022-08-18T23:56:45.000Z",
      "content": "What does it mean to say that Lehi’s son Joseph is blessed because of the covenant? How is he blessed? Why is it an important blessing to know that your descendants many generations hence will not be destroyed? https://bookofmormon.online/promised-land/lehi/69"
    },
    {
      "seq": "600",
      "time": "2022-08-19T06:48:10.000Z",
      "content": "Why does he rehearse how he came to be king? https://bookofmormon.online/benjamin/4"
    },
    {
      "seq": "1572",
      "time": "2022-08-19T13:39:36.000Z",
      "content": "What is this commandment about? Why does the Savior give it special place by drawing such attention to it? https://bookofmormon.online/jesus/142"
    },
    {
      "seq": "1429",
      "time": "2022-08-19T20:31:02.000Z",
      "content": "What promises have been extended to the Lamanites in the last days? Does verse 13 describe those promises completely? https://bookofmormon.online/samuel/46"
    },
    {
      "seq": "1505",
      "time": "2022-08-20T03:22:27.000Z",
      "content": "Notice that the Book of Mormon and the JST omit “without a cause” ( Matthew 5:22 KJV) in verse 22—as do almost all Greek manuscripts. How does that change our understanding of the verse? https://bookofmormon.online/jesus/70"
    },
    {
      "seq": "1311",
      "time": "2022-08-20T10:13:53.000Z",
      "content": "What is the significance of cutting in two all of the devil’s wiles and snares? Explore that metaphor: what is the point of the metaphor as a whole? The sword? The snare? Cutting a snare? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "1259",
      "time": "2022-08-20T17:05:19.000Z",
      "content": "Based on what we see here, what kinds of circumstances justify warfare? https://bookofmormon.online/war/3"
    },
    {
      "seq": "172",
      "time": "2022-08-20T23:56:45.000Z",
      "content": "What does Lehi mean when he says “salvation is free”? How does that fit with what he says in verse 3? https://bookofmormon.online/promised-land/lehi/19"
    },
    {
      "seq": "1740",
      "time": "2022-08-21T06:48:10.000Z",
      "content": "Why do we strip ourselves of uncleanness? What might that metaphor suggest? In what sense is uncleanness something that we have put on, an addition to who we are? https://bookofmormon.online/moroni/29"
    },
    {
      "seq": "975",
      "time": "2022-08-21T13:39:36.000Z",
      "content": "Zeezrom has become conscious of his guilt. What in particular might have brought about that consciousness? https://bookofmormon.online/reign-of-judges/ammonihah/82"
    },
    {
      "seq": "1840",
      "time": "2022-08-21T20:31:02.000Z",
      "content": "How does Moroni understand what it means to be perfect? How might that be different than our everyday understanding of perfection? https://bookofmormon.online/moroni/116"
    },
    {
      "seq": "183",
      "time": "2022-08-22T03:22:27.000Z",
      "content": "To think about what is being said here, ask yourself what it means to rely only on the merit of the Messiah. Then ask yourself what it means to rely only on his mercy, and then only on his grace. https://bookofmormon.online/promised-land/lehi/22"
    },
    {
      "seq": "931",
      "time": "2022-08-22T10:13:53.000Z",
      "content": "What does it mean to be stripped of pride? Why are we unprepared to meet God if we are not stripped of pride? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/17"
    },
    {
      "seq": "1562",
      "time": "2022-08-22T17:05:19.000Z",
      "content": "What is the import of these verses? What would this vision have meant to the Nephites? What might it mean to us? https://bookofmormon.online/jesus/123"
    },
    {
      "seq": "490",
      "time": "2022-08-22T23:56:45.000Z",
      "content": "What does Jacob point to as the problem of riches? How do we avoid that problem? https://bookofmormon.online/jacobs-address/6"
    },
    {
      "seq": "1320",
      "time": "2022-08-23T06:48:10.000Z",
      "content": "Here we are told what caused those dissensions. How might we might be guilty of each of these today? https://bookofmormon.online/gadianton/29"
    },
    {
      "seq": "954",
      "time": "2022-08-23T13:39:36.000Z",
      "content": "Alma says, “If you have faith, hope, and charity, then you will always do good works.” Do faith, hope, and charity guarantee good works? If so, how? Can we do good works without them? If not, why not? https://bookofmormon.online/reign-of-judges/gideon/15"
    },
    {
      "seq": "578",
      "time": "2022-08-23T20:31:02.000Z",
      "content": "What do these verses show us about the Book of Mormon and Book of Mormon peoples? https://bookofmormon.online/land-of-nephi/33"
    },
    {
      "seq": "559",
      "time": "2022-08-24T03:22:27.000Z",
      "content": "Can you think of specific things in Jacob’s teaching to which Enos may be referring when he writes about the words he had often heard his father speak? https://bookofmormon.online/land-of-nephi/29"
    },
    {
      "seq": "900",
      "time": "2022-08-24T10:13:53.000Z",
      "content": "What are the three things that distinguish this church? https://bookofmormon.online/reign-of-judges/12"
    },
    {
      "seq": "1453",
      "time": "2022-08-24T17:05:19.000Z",
      "content": "What is the great inequality that began to be in the land? https://bookofmormon.online/gadianton/168"
    },
    {
      "seq": "937",
      "time": "2022-08-24T23:56:45.000Z",
      "content": "From where do the images that Alma uses in these verses come? What do those scriptures have to do with Alma’s message? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/22"
    },
    {
      "seq": "432",
      "time": "2022-08-25T06:48:10.000Z",
      "content": "When Nephi says he delights in plainness, “for after this manner doth the Lord God work,” what is he telling us? https://bookofmormon.online/nephis-testimony/2"
    },
    {
      "seq": "1617",
      "time": "2022-08-25T13:39:36.000Z",
      "content": "What is Jesus describing? How has Israel been forsaken? To what is he referring when he says “this, the waters of Noah unto me”? What do the waters of Noah have to do with covenants? https://bookofmormon.online/jesus-teachings/43"
    },
    {
      "seq": "607",
      "time": "2022-08-25T20:31:02.000Z",
      "content": "What does it mean that he supports us from moment to moment? https://bookofmormon.online/benjamin/13"
    },
    {
      "seq": "781",
      "time": "2022-08-26T03:22:27.000Z",
      "content": "What does it mean to say he will get a portion with the great and will divide the spoil with the strong? https://bookofmormon.online/recolonization/abinadi/30"
    },
    {
      "seq": "1401",
      "time": "2022-08-26T10:13:53.000Z",
      "content": "Why does the Lord say he will withdraw from them because of the hardness of their hearts, rather than because of their wickedness? https://bookofmormon.online/samuel/4"
    },
    {
      "seq": "1051",
      "time": "2022-08-26T17:05:19.000Z",
      "content": "In some cities and regions all, or almost all, of the inhabitants are converted; and in others none, or almost none, are converted. What would account for these differences? https://bookofmormon.online/aaron/41"
    },
    {
      "seq": "1767",
      "time": "2022-08-26T23:56:45.000Z",
      "content": "The Savior makes a distinction between believing his words and believing him. What’s the difference? https://bookofmormon.online/moroni/49"
    },
    {
      "seq": "966",
      "time": "2022-08-27T06:48:10.000Z",
      "content": "What does “devices of the devil” mean? https://bookofmormon.online/reign-of-judges/ammonihah/61"
    },
    {
      "seq": "1482",
      "time": "2022-08-27T13:39:36.000Z",
      "content": "Why is this the preface to the part of Christ’s sermon on his doctrine? What does this tell us about how to teach the gospel? Does it teach anything more? https://bookofmormon.online/jesus/55"
    },
    {
      "seq": "594",
      "time": "2022-08-27T20:31:02.000Z",
      "content": "Why does King Benjamin give his son the sword of Laban and the Liahona? Of what might they be symbolic? https://bookofmormon.online/lehites/113"
    },
    {
      "seq": "209",
      "time": "2022-08-28T03:22:27.000Z",
      "content": "Is the word Adam being used here of only Father Adam, or is it being used as it is used in Genesis 1:27, “God created man [ adam] in his own image, . . . male and female created he them”? https://bookofmormon.online/promised-land/lehi/37"
    },
    {
      "seq": "678",
      "time": "2022-08-28T10:13:53.000Z",
      "content": "Of all the things on the list, why does Benjamin give so much emphasis to this particular one? https://bookofmormon.online/benjamin/76"
    },
    {
      "seq": "381",
      "time": "2022-08-28T17:05:19.000Z",
      "content": "How does the Book of Mormon persuade us to believe in Christ? How does it persuade us to be reconciled to God? What does it mean to be saved by grace? (Compare 2 Nephi 31:19; Mosiah 2:21; and Luke 17:7–10.) https://bookofmormon.online/nephis-teachings/11"
    },
    {
      "seq": "482",
      "time": "2022-08-28T23:56:45.000Z",
      "content": "Why do you think Jacob taught them in the temple? Why does he describe his calling and consecration as a priest and teacher as an “errand from the Lord”? What does it mean to be consecrated a priest? https://bookofmormon.online/jacobs-address/1"
    },
    {
      "seq": "828",
      "time": "2022-08-29T06:48:10.000Z",
      "content": "Flattery is often mentioned by the Book of Mormon in connection with people being deceived into leaving the church. How does that happen? What kind of flattery is involved? https://bookofmormon.online/zarahemla/51"
    },
    {
      "seq": "1268",
      "time": "2022-08-29T13:39:36.000Z",
      "content": "What does Moroni mean by “rites of worship”? By “the sacred support which we owe to our wives and children”? By “liberty”? https://bookofmormon.online/war/26"
    },
    {
      "seq": "668",
      "time": "2022-08-29T20:31:02.000Z",
      "content": "and to love one another and to serve one another succor those who need succor administer our substance to those who need it (what does the word substance mean?) https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1832",
      "time": "2022-08-30T03:22:27.000Z",
      "content": "Why is this exhortation to remember the gifts of God important to Moroni’s audience? https://bookofmormon.online/moroni/103"
    },
    {
      "seq": "936",
      "time": "2022-08-30T10:13:53.000Z",
      "content": "Is it significant that the Lord doesn’t demand but offers an invitation? Why do we have to repent in order for him to receive us? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/21"
    },
    {
      "seq": "1228",
      "time": "2022-08-30T17:05:19.000Z",
      "content": "Why do you think Alma reiterates what he doesn’t know when he tells Corianton about the resurrection? https://bookofmormon.online/reign-of-judges/corianton/8"
    },
    {
      "seq": "226",
      "time": "2022-08-30T23:56:45.000Z",
      "content": "How is the Prophet Joseph like Joseph of Egypt? How did the ancient Joseph bring the Lord’s people salvation, and how is that like what the modern Joseph did? https://bookofmormon.online/promised-land/lehi/57"
    },
    {
      "seq": "152",
      "time": "2022-08-31T06:48:10.000Z",
      "content": "How does this verse explain the scattering of Israel, including the scattering of Lehi’s family? Who were the pastors—shepherds—of the Israelites? (Compare Ezekiel 34:1–10.) https://bookofmormon.online/brass-plates/9"
    },
    {
      "seq": "1315",
      "time": "2022-08-31T13:39:36.000Z",
      "content": "What does sitting down with Abraham, Isaac, and Jacob signify? Why them in particular? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "385",
      "time": "2022-08-31T20:31:02.000Z",
      "content": "What does it mean to say that they do what they do “because of the commandment,” especially if the law is dead to them? https://bookofmormon.online/nephis-teachings/12"
    },
    {
      "seq": "501",
      "time": "2022-09-01T03:22:27.000Z",
      "content": "Why did Jacob deliver this part of the message second, and the part about pride and seeking for riches first? https://bookofmormon.online/jacobs-address/10"
    },
    {
      "seq": "338",
      "time": "2022-09-01T10:13:53.000Z",
      "content": "What is the relation of this verse to the two that immediately precede it? https://bookofmormon.online/jacobs-sermon/42"
    },
    {
      "seq": "1720",
      "time": "2022-09-01T17:05:19.000Z",
      "content": "How do people transfigure the word of God? Can they do so unintentionally? Do we ever do so, intentionally or unintentionally? https://bookofmormon.online/moroni/14"
    },
    {
      "seq": "1152",
      "time": "2022-09-01T23:56:45.000Z",
      "content": "What does it mean to taste light? Why does Alma keep returning to metaphors of taste? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/22"
    },
    {
      "seq": "762",
      "time": "2022-09-02T06:48:10.000Z",
      "content": "What does it mean to remember the Lord? https://bookofmormon.online/recolonization/abinadi/17"
    },
    {
      "seq": "1249",
      "time": "2022-09-02T13:39:36.000Z",
      "content": "Here is one way to read what Alma is saying: God has given a law with necessary consequences, and then he takes those consequences on himself if we allow him to do so. Does that make sense? Can you explain what Alma says in another way? https://bookofmormon.online/reign-of-judges/corianton/34"
    },
    {
      "seq": "798",
      "time": "2022-09-02T20:31:02.000Z",
      "content": "Are Abinadi’s three days in prison a shadow of Christ’s death? https://bookofmormon.online/recolonization/46"
    },
    {
      "seq": "1239",
      "time": "2022-09-03T03:22:27.000Z",
      "content": "We often quote, “Wickedness never was happiness.” What does it mean in the context of Alma’s discussion of restoration? https://bookofmormon.online/reign-of-judges/corianton/22"
    },
    {
      "seq": "254",
      "time": "2022-09-03T10:13:53.000Z",
      "content": "What is the difference between being ordained and being consecrated? (Or is there a difference?) https://bookofmormon.online/jacobs-sermon/1"
    },
    {
      "seq": "1407",
      "time": "2022-09-03T17:05:19.000Z",
      "content": "Does this verse answer the question above, about verse 20? What does it mean not to remember the Lord in the things with which he has blessed us? What does it mean to remember our riches? https://bookofmormon.online/samuel/16"
    },
    {
      "seq": "36",
      "time": "2022-09-03T23:56:45.000Z",
      "content": "The Spirit uses the word witness to mean “see” in this verse rather than to mean “testify” or “bear record.” Why does he use the word witness rather than the word see? https://bookofmormon.online/lehites/nephis-vision/4"
    },
    {
      "seq": "1504",
      "time": "2022-09-04T06:48:10.000Z",
      "content": "Jesus seems to me to be giving examples of what he meant when he spoke of peacemakers in verse 9. https://bookofmormon.online/jesus/70"
    },
    {
      "seq": "1153",
      "time": "2022-09-04T13:39:36.000Z",
      "content": "Why do we need to continue to exercise faith once we know that the word is good? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/23"
    },
    {
      "seq": "493",
      "time": "2022-09-04T20:31:02.000Z",
      "content": "What does it mean to think of our brothers and sisters like ourselves (verse 17)? What does it mean to be familiar with all? Can you think of specific ways in which you can do this? https://bookofmormon.online/jacobs-address/7"
    },
    {
      "seq": "815",
      "time": "2022-09-05T03:22:27.000Z",
      "content": "What do you make of the odd use of the word ceremony? To what does it refer? https://bookofmormon.online/recolonization/69"
    },
    {
      "seq": "1762",
      "time": "2022-09-05T10:13:53.000Z",
      "content": "Those who “deny these things” will also be accursed. To what does “these things” refer? What the brother of Jared learned? His experience? The book of Ether? The Book of Mormon? https://bookofmormon.online/moroni/45"
    },
    {
      "seq": "1828",
      "time": "2022-09-05T17:05:19.000Z",
      "content": "Why is God’s mercy to human beings, from Adam to the present, the topic on which Moroni wishes his readers to meditate? Why is that an essential preface to the exhortation that follows? https://bookofmormon.online/moroni/101"
    },
    {
      "seq": "1639",
      "time": "2022-09-05T23:56:45.000Z",
      "content": "What does it mean to take Christ’s name upon us? (What sermon in the book of Mormon has the most to say about that?) When we are told to endure to the end, what are we to endure? https://bookofmormon.online/jesus/215"
    },
    {
      "seq": "611",
      "time": "2022-09-06T06:48:10.000Z",
      "content": "Here Benjamin repeats verse 22, with an addition: We are required to be obedient, and if we are, we are immediately blessed and so are still in debt. What do you make of that addition? https://bookofmormon.online/benjamin/17"
    },
    {
      "seq": "1726",
      "time": "2022-09-06T13:39:36.000Z",
      "content": "The beginning of this verse is a little odd. How would we adorn ourselves with what has life? What adornment would that be? Does the verse say we shouldn’t adorn ourselves with what doesn’t have life? https://bookofmormon.online/moroni/17"
    },
    {
      "seq": "723",
      "time": "2022-09-06T20:31:02.000Z",
      "content": "Why do you think the scriptures use the metaphor of walking on a path or road (a way) for being obedient? https://bookofmormon.online/recolonization/24"
    },
    {
      "seq": "1712",
      "time": "2022-09-07T03:22:27.000Z",
      "content": "To whom are these verses addressed? https://bookofmormon.online/moroni/6"
    },
    {
      "seq": "1029",
      "time": "2022-09-07T10:13:53.000Z",
      "content": "Ammon says, “I will do whatever you ask, if it is right.” Lamoni responds, “I will give you anything you desire.” What is happening? https://bookofmormon.online/ammon/36"
    },
    {
      "seq": "1473",
      "time": "2022-09-07T17:05:19.000Z",
      "content": "How is the particular way in which the Lord introduced himself to the Nephites significant? https://bookofmormon.online/jesus/43"
    },
    {
      "seq": "518",
      "time": "2022-09-07T23:56:45.000Z",
      "content": "How does he want us to think of those whom he writes about? https://bookofmormon.online/land-of-nephi/15"
    },
    {
      "seq": "593",
      "time": "2022-09-08T06:48:10.000Z",
      "content": "How does his sermon about Christ and the Atonement, the central part of his message, fit with his desires to give the people a ruler and a name? Why doesn’t he mention that as one of his desires? https://bookofmormon.online/zarahemla/20"
    },
    {
      "seq": "373",
      "time": "2022-09-08T13:39:36.000Z",
      "content": "In verse 4, Nephi said his soul delights in plainness. Here he says his soul delights in Isaiah. Does that mean that Isaiah is plain? (He does say, after all, that the Jews understood Isaiah.) https://bookofmormon.online/nephis-teachings/3"
    },
    {
      "seq": "392",
      "time": "2022-09-08T20:31:02.000Z",
      "content": "What image does the phrase “lifted up in the pride of their eyes” convey? How is that appropriate to the meaning conveyed? https://bookofmormon.online/nephis-teachings/21"
    },
    {
      "seq": "1344",
      "time": "2022-09-09T03:22:27.000Z",
      "content": "Why do they want gain? What does it mean to be lifted up above another? What’s wrong with it? How do we lift ourselves above others? https://bookofmormon.online/gadianton/78"
    },
    {
      "seq": "1471",
      "time": "2022-09-09T10:13:53.000Z",
      "content": "The voice heard pierced the Nephites. Is the use of that word merely a coincidence, or is it connected to Christ’s piercing in some way? If the latter, how? https://bookofmormon.online/jesus/39"
    },
    {
      "seq": "861",
      "time": "2022-09-09T17:05:19.000Z",
      "content": "What difference would explain why Alma the Younger went through such a horrible experience and the sons of Mosiah don’t seem to have? Both he and they seem equally converted. Why would he have to experience such torment and not they? https://bookofmormon.online/zarahemla/79"
    },
    {
      "seq": "893",
      "time": "2022-09-09T23:56:45.000Z",
      "content": "What are Nehor’s doctrines? For what appears to be more of them, see Alma 15:15 and 21:6–8. https://bookofmormon.online/reign-of-judges/2"
    },
    {
      "seq": "992",
      "time": "2022-09-10T06:48:10.000Z",
      "content": "What does “the rest of God” mean? How do we enter into it? Consider reading chapter 13 with this lesson. Is it a chapter on “the rest of God”? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/14"
    },
    {
      "seq": "507",
      "time": "2022-09-10T13:39:36.000Z",
      "content": "What does it mean to “receive the pleasing word of God”? https://bookofmormon.online/jacobs-address/14"
    },
    {
      "seq": "289",
      "time": "2022-09-10T20:31:02.000Z",
      "content": "Why is it important in this context to remind Israel that the Lord is the Creator (verse 13)? Verse 13 describes the man at the end of verse 12 “who shall die” and “who shall be made like unto grass.” https://bookofmormon.online/jacobs-sermon/16"
    },
    {
      "seq": "794",
      "time": "2022-09-11T03:22:27.000Z",
      "content": "What is Abinadi prophesying? https://bookofmormon.online/recolonization/abinadi/46"
    },
    {
      "seq": "1542",
      "time": "2022-09-11T10:13:53.000Z",
      "content": "This is one version of the Golden Rule. Can a person who is not pure in heart use the Golden Rule as an accurate standard of his conduct? What problem might he encounter using it? https://bookofmormon.online/jesus/95"
    },
    {
      "seq": "957",
      "time": "2022-09-11T17:05:19.000Z",
      "content": "Prophets in the Book of Mormon often begin their calls to repentance by reminding the people of what the Lord has done for their ancestors (e.g., Alma the Younger did this in his sermon in Alma 5). Why? https://bookofmormon.online/reign-of-judges/ammonihah/18"
    },
    {
      "seq": "1838",
      "time": "2022-09-11T23:56:45.000Z",
      "content": "Grammatically the opening of this verse, “Yea, come unto Christ, and be perfected in him,” suggests that this verse is parallel to verse 31. Is that right? If so, explain what the parallels are. https://bookofmormon.online/moroni/116"
    },
    {
      "seq": "1187",
      "time": "2022-09-12T06:48:10.000Z",
      "content": "Why does Alma begin by asking Helaman to remember the captivity of their fathers? What captivity do you think he has in mind? (Compare Mosiah 27:16.) https://bookofmormon.online/reign-of-judges/helaman/1"
    },
    {
      "seq": "1700",
      "time": "2022-09-12T13:39:36.000Z",
      "content": "What does Mormon mean when he calls the Nephites “fair ones”? At this point in Nephite and Lamanite history, it is doubtful he is talking about their skin color. But given what we have seen, he also can’t be talking about their character. https://bookofmormon.online/downfall/128"
    },
    {
      "seq": "1380",
      "time": "2022-09-12T20:31:02.000Z",
      "content": "If Nephi has already been given the authority that whatever he says will come to pass, why does he pray to the Lord here, asking that the famine be stopped? Why not just command it to stop? https://bookofmormon.online/nephi/67"
    },
    {
      "seq": "474",
      "time": "2022-09-13T03:22:27.000Z",
      "content": "At this point in the Book of Mormon it’s been about fifty-five years since the Nephites landed in the New World. About how old would Nephi have been? https://bookofmormon.online/land-of-nephi/11"
    },
    {
      "seq": "1213",
      "time": "2022-09-13T10:13:53.000Z",
      "content": "How does Alma’s conversion story show us that we can be saved only in and through Christ? https://bookofmormon.online/reign-of-judges/shiblon/5"
    },
    {
      "seq": "726",
      "time": "2022-09-13T17:05:19.000Z",
      "content": "As you read from here through verse 11, think about how Noah and Solomon compare. How are they the same? How are they different? Do you think the writer makes that comparison intentionally? If so, why? https://bookofmormon.online/recolonization/25"
    },
    {
      "seq": "1052",
      "time": "2022-09-13T23:56:45.000Z",
      "content": "Why do you think a new name would be so important to these converts? Do you have any ideas as to why they might have chosen the name that they did? Your guess would be as good as anyone else’s. https://bookofmormon.online/aaron/44"
    },
    {
      "seq": "1312",
      "time": "2022-09-14T06:48:10.000Z",
      "content": "How does the word lead us along the narrow way or course? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "604",
      "time": "2022-09-14T13:39:36.000Z",
      "content": "Notice the things we might do for God and what God might do for us: https://bookofmormon.online/benjamin/13"
    },
    {
      "seq": "873",
      "time": "2022-09-14T20:31:02.000Z",
      "content": "Is this verse parallel to verse 2? Why would Alma begin and end the account of his conversion by reminding Helaman of this scriptural type? https://bookofmormon.online/reign-of-judges/helaman/9"
    },
    {
      "seq": "892",
      "time": "2022-09-15T03:22:27.000Z",
      "content": "Alma judged righteously and there was peace throughout the land. Is that a cause and effect relation? If so, how so? https://bookofmormon.online/zarahemla/105"
    },
    {
      "seq": "702",
      "time": "2022-09-15T10:13:53.000Z",
      "content": "Benjamin says his people who have entered into the covenant should take Christ’s name on themselves so that they will be obedient to the end of the lives. How does taking his name on ourselves make us obedient? What is Benjamin saying? https://bookofmormon.online/benjamin/94"
    },
    {
      "seq": "504",
      "time": "2022-09-15T17:05:19.000Z",
      "content": "Has Jacob saved “the word which healeth the wounded soul” ( Jacob 2:8) for now? https://bookofmormon.online/jacobs-address/14"
    },
    {
      "seq": "884",
      "time": "2022-09-15T23:56:45.000Z",
      "content": "Israelites also had this belief, that the wickedness of a king causes the wickedness of a nation. It was the flip side of the belief that a king typifies the Messiah. What bearing does this belief have on our understanding of government? https://bookofmormon.online/zarahemla/101"
    },
    {
      "seq": "949",
      "time": "2022-09-16T06:48:10.000Z",
      "content": "Verse 12 teaches a doctrine that is hidden from most of the rest of the world, that Christ suffered so he will know how to succor his people. What does succor mean? How does Christ succor us? https://bookofmormon.online/reign-of-judges/gideon/5"
    },
    {
      "seq": "1166",
      "time": "2022-09-16T13:39:36.000Z",
      "content": "The Book of Mormon never refers to the tree of knowledge, only to the tree of life. Why? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/27"
    },
    {
      "seq": "824",
      "time": "2022-09-16T20:31:02.000Z",
      "content": "What is the point of the remark that the groups of believers were called churches? https://bookofmormon.online/zarahemla/49"
    },
    {
      "seq": "1292",
      "time": "2022-09-17T03:22:27.000Z",
      "content": "Why would these departures, rather than Shiblon’s impending death, have made it necessary for Shiblon to pass the records to Helaman’s son Helaman? https://bookofmormon.online/war/138"
    },
    {
      "seq": "840",
      "time": "2022-09-17T10:13:53.000Z",
      "content": "Notice that there is no description in the Book of Mormon of what we usually think of as idol worship. Does that mean that the Nephites didn’t have a problem with idol worship or just that it isn’t mentioned? Why might it not be mentioned? https://bookofmormon.online/zarahemla/68"
    },
    {
      "seq": "1188",
      "time": "2022-09-17T17:05:19.000Z",
      "content": "Alma tells Helaman the principle he wishes him to learn. Why is this principle so important that it required gathering his sons together and giving them these individual admonitions? https://bookofmormon.online/reign-of-judges/helaman/2"
    },
    {
      "seq": "1648",
      "time": "2022-09-17T23:56:45.000Z",
      "content": "What does this verse tell us about what Jesus means when he says he will “draw all men” unto him? https://bookofmormon.online/jesus/219"
    },
    {
      "seq": "524",
      "time": "2022-09-18T06:48:10.000Z",
      "content": "How do we try to counsel the Lord? How do we take counsel from him? https://bookofmormon.online/land-of-nephi/23"
    },
    {
      "seq": "1742",
      "time": "2022-09-18T13:39:36.000Z",
      "content": "To what does this refer in “if you do this”? https://bookofmormon.online/moroni/29"
    },
    {
      "seq": "193",
      "time": "2022-09-18T20:31:02.000Z",
      "content": "Why would the world have been created for nothing, without purpose, if there were no opposition? Why would that “destroy the wisdom of God and his eternal purposes, and also the power, and the mercy, and the justice of God”? https://bookofmormon.online/promised-land/lehi/28"
    },
    {
      "seq": "171",
      "time": "2022-09-19T03:22:27.000Z",
      "content": "Why is it important to know that the way is prepared “from the fall”? https://bookofmormon.online/promised-land/lehi/19"
    },
    {
      "seq": "819",
      "time": "2022-09-19T10:13:53.000Z",
      "content": "Does this have anything to do with the covenant of baptism described in Mosiah 18:9? https://bookofmormon.online/alma/32"
    },
    {
      "seq": "1040",
      "time": "2022-09-19T17:05:19.000Z",
      "content": "What reforms did Lamoni make on his return home? Why those reforms in particular? https://bookofmormon.online/ammon/105"
    },
    {
      "seq": "508",
      "time": "2022-09-19T23:56:45.000Z",
      "content": "What does it mean to “feast upon his love”? How is that related to feasting on the word ( 2 Nephi 31:20; 32:3)? https://bookofmormon.online/jacobs-address/14"
    },
    {
      "seq": "1819",
      "time": "2022-09-20T06:48:10.000Z",
      "content": "As you read Mormon’s sermon, ask yourself what might have been its occasion. Given the content of the first twenty-one verses, why does Moroni say that this is a sermon on faith, hope, and charity (verse 1)? https://bookofmormon.online/downfall/48"
    },
    {
      "seq": "621",
      "time": "2022-09-20T13:39:36.000Z",
      "content": "In what other incident does an angel speak of his message as “glad tidings of great joy” or something similar? Are there any parallels between the other case and this one? https://bookofmormon.online/benjamin/37"
    },
    {
      "seq": "505",
      "time": "2022-09-20T20:31:02.000Z",
      "content": "What does it mean to be pure in heart? https://bookofmormon.online/jacobs-address/14"
    },
    {
      "seq": "1170",
      "time": "2022-09-21T03:22:27.000Z",
      "content": "What do the Zoramites desire? Have they understood what Alma has taught them? What is your evidence for your answer? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/31"
    },
    {
      "seq": "698",
      "time": "2022-09-21T10:13:53.000Z",
      "content": "What does it mean to be free? https://bookofmormon.online/benjamin/94"
    },
    {
      "seq": "608",
      "time": "2022-09-21T17:05:19.000Z",
      "content": "What is a profitable employee (servant)? What does it mean to say that we are unprofitable servants even when we do everything in our power to thank and praise and serve God? https://bookofmormon.online/benjamin/13"
    },
    {
      "seq": "1724",
      "time": "2022-09-21T23:56:45.000Z",
      "content": "What does it mean to love these things more than we love the poor and the needy? How would we tell if we were described by this verse? https://bookofmormon.online/moroni/16"
    },
    {
      "seq": "1123",
      "time": "2022-09-22T06:48:10.000Z",
      "content": "Was Alma’s experience with the angel enough to give him knowledge? (Compare Alma 5:45–46.) https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/10"
    },
    {
      "seq": "758",
      "time": "2022-09-22T13:39:36.000Z",
      "content": "Why doesn’t salvation come by the law alone? https://bookofmormon.online/recolonization/abinadi/15"
    },
    {
      "seq": "1005",
      "time": "2022-09-22T20:31:02.000Z",
      "content": "Do these verses mean that all who receive the high priesthood are sanctified? Why or why not? Who can be sanctified? How? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1165",
      "time": "2022-09-23T03:22:27.000Z",
      "content": "Alma has spoken of the tree of life before ( Alma 5:34, 62; 12:21–26). Do those earlier discussions shed light on what he is saying here? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/27"
    },
    {
      "seq": "525",
      "time": "2022-09-23T10:13:53.000Z",
      "content": "This verse begins with “Wherefore . . . ,” indicating that it follows from the previous verses. How is that so? https://bookofmormon.online/land-of-nephi/23"
    },
    {
      "seq": "977",
      "time": "2022-09-23T17:05:19.000Z",
      "content": "Satan laid a trap for Zeezrom by getting Zeezrom to lay a trap for Alma. How is Satan’s trap similar to Zeezrom’s? https://bookofmormon.online/reign-of-judges/ammonihah/83"
    },
    {
      "seq": "547",
      "time": "2022-09-23T23:56:45.000Z",
      "content": "As the trees grow, the master commands that the workers are to gradually remove the worst branches. https://bookofmormon.online/olive-tree/39"
    },
    {
      "seq": "8",
      "time": "2022-09-24T06:48:10.000Z",
      "content": "What does it mean to say that people are chosen “because of their faith”? (Compare 1 Nephi 2:19.) https://bookofmormon.online/lehites/10"
    },
    {
      "seq": "1736",
      "time": "2022-09-24T13:39:36.000Z",
      "content": "What does this verse mean? What does it mean that the Savior will confirm his words “even unto the ends of the earth”? https://bookofmormon.online/moroni/26"
    },
    {
      "seq": "1330",
      "time": "2022-09-24T20:31:02.000Z",
      "content": "What are the conditions of repentance? Where can you find them in the Book of Mormon? https://bookofmormon.online/gadianton/43"
    },
    {
      "seq": "253",
      "time": "2022-09-25T03:22:27.000Z",
      "content": "Nephi says that he and his people “lived after the manner of happiness.” What does that phrase say that the phrase “we lived happily” doesn’t say? What is “the manner [or ‘way’] of happiness”? https://bookofmormon.online/land-of-nephi/6"
    },
    {
      "seq": "577",
      "time": "2022-09-25T10:13:53.000Z",
      "content": "What does this verse tell us about the Nephite people at the time of Abinadom? https://bookofmormon.online/land-of-nephi/33"
    },
    {
      "seq": "622",
      "time": "2022-09-25T17:05:19.000Z",
      "content": "What do you suppose Benjamin had been praying for in order to receive this answer? https://bookofmormon.online/benjamin/38"
    },
    {
      "seq": "1547",
      "time": "2022-09-25T23:56:45.000Z",
      "content": "The Nephites respond to this sermon by wondering about the passing of the law of Moses. How was the response in Galilee different? Do those differences tell us anything about the two groups of people? https://bookofmormon.online/jesus/101"
    },
    {
      "seq": "568",
      "time": "2022-09-26T06:48:10.000Z",
      "content": "What do we learn from Enos’s reaction to receiving forgiveness? To whom do his thoughts turn? https://bookofmormon.online/land-of-nephi/32"
    },
    {
      "seq": "848",
      "time": "2022-09-26T13:39:36.000Z",
      "content": "Alma the Elder uses his son as a testimony of God’s power. Notice that he calls people to see “what the Lord had done for his son.” At this point, what had the Lord done besides frighten him into unconsciousness? https://bookofmormon.online/zarahemla/76"
    },
    {
      "seq": "1422",
      "time": "2022-09-26T20:31:02.000Z",
      "content": "The second word of the verse is this. To what does it refer? In other words, what is this verse explaining? https://bookofmormon.online/samuel/38"
    },
    {
      "seq": "1408",
      "time": "2022-09-27T03:22:27.000Z",
      "content": "How do pride, boasting, great swelling, and so on, result from remembering our riches and forgetting God, as the verse implies they do? https://bookofmormon.online/samuel/16"
    },
    {
      "seq": "259",
      "time": "2022-09-27T10:13:53.000Z",
      "content": "Jacob tells us (verse 4) that he will read from Isaiah because Nephi asked him to. Why do you think Nephi picked these sections of Isaiah? https://bookofmormon.online/jacobs-sermon/2"
    },
    {
      "seq": "1553",
      "time": "2022-09-27T17:05:19.000Z",
      "content": "Does the Savior think what he has said is easy to understand? Are the things he has taught “plain and simple”? Why haven’t the Nephites understood him well? https://bookofmormon.online/jesus/115"
    },
    {
      "seq": "1575",
      "time": "2022-09-27T23:56:45.000Z",
      "content": "What might it mean to say that it is expedient that Jesus go to the Father for their sakes? https://bookofmormon.online/jesus/145"
    },
    {
      "seq": "872",
      "time": "2022-09-28T06:48:10.000Z",
      "content": "Why does Alma have a vision of Lehi at this point? https://bookofmormon.online/zarahemla/77"
    },
    {
      "seq": "169",
      "time": "2022-09-28T13:39:36.000Z",
      "content": "What does it mean to say that the righteousness of the Redeemer redeems us rather than he himself does? What does it mean to say to Jacob, still a young man, that he is redeemed rather than that he will be? https://bookofmormon.online/promised-land/lehi/19"
    },
    {
      "seq": "1560",
      "time": "2022-09-28T20:31:02.000Z",
      "content": "Why would Mormon think it is important for us to know about this prayer if it is impossible for us to know its contents? https://bookofmormon.online/jesus/118"
    },
    {
      "seq": "333",
      "time": "2022-09-29T03:22:27.000Z",
      "content": "Notice how the command to shake off our chains resonates with the previous verse (and its reference to other verses) to tie these things together. https://bookofmormon.online/jacobs-sermon/39"
    },
    {
      "seq": "1728",
      "time": "2022-09-29T10:13:53.000Z",
      "content": "What does “nakedness before God” mean? https://bookofmormon.online/moroni/20"
    },
    {
      "seq": "440",
      "time": "2022-09-29T17:05:19.000Z",
      "content": "Compare what Nephi teaches here with 3 Nephi 18:24. How are these two teachings related? https://bookofmormon.online/nephis-testimony/5"
    },
    {
      "seq": "1333",
      "time": "2022-09-29T23:56:45.000Z",
      "content": "Notice that Helaman’s sons “went forth, keeping the commandments” because they remembered what he had said. Does that mean children who don’t do what their parents tell them have forgotten? In what sense might that be true? https://bookofmormon.online/gadianton/46"
    },
    {
      "seq": "1134",
      "time": "2022-09-30T06:48:10.000Z",
      "content": "Is it significant that Alma has shifted from his word (verse 27) to the word? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/16"
    },
    {
      "seq": "1597",
      "time": "2022-09-30T13:39:36.000Z",
      "content": "When mentioning the prophets after Moses, the scriptures consistently say “the prophets from Samuel and those that follow after him,” or something like that. Why do they omit Joshua? https://bookofmormon.online/jesus-teachings/11"
    },
    {
      "seq": "1042",
      "time": "2022-09-30T20:31:02.000Z",
      "content": "How does Aaron’s sermon to Lamoni’s father differ from Ammon’s sermon to Lamoni ( Alma 18:23–39)? Can you explain the difference? https://bookofmormon.online/aaron/18"
    },
    {
      "seq": "1055",
      "time": "2022-10-01T03:22:27.000Z",
      "content": "How does the king explain the symbolism of hiding away their swords? https://bookofmormon.online/ammon/115"
    },
    {
      "seq": "238",
      "time": "2022-10-01T10:13:53.000Z",
      "content": "Here we see Nephi turn from grief in the beginning of the verse to hope in the end. What does the change we see happening in this verse tell us about our own sorrows? Is sorrow or guilt bad? https://bookofmormon.online/promised-land/46"
    },
    {
      "seq": "1707",
      "time": "2022-10-01T17:05:19.000Z",
      "content": "What does it mean to be found guiltless before Christ? https://bookofmormon.online/mormon/94"
    },
    {
      "seq": "1036",
      "time": "2022-10-01T23:56:45.000Z",
      "content": "Of what significance is it that this miracle is done by a servant woman, Abish, rather than by Ammon? https://bookofmormon.online/ammon/76"
    },
    {
      "seq": "961",
      "time": "2022-10-02T06:48:10.000Z",
      "content": "How does this description of the Savior square with verses 19–24? https://bookofmormon.online/reign-of-judges/ammonihah/32"
    },
    {
      "seq": "700",
      "time": "2022-10-02T13:39:36.000Z",
      "content": "King Benjamin’s grammar makes being free and receiving salvation parallel. In what sense or senses do they mean the same thing? https://bookofmormon.online/benjamin/94"
    },
    {
      "seq": "66",
      "time": "2022-10-02T20:31:02.000Z",
      "content": "Why might there be a break in the vision at this point, with a kind of end to the vision, followed by a new beginning in verse 30? https://bookofmormon.online/lehites/nephis-vision/15"
    },
    {
      "seq": "1275",
      "time": "2022-10-03T03:22:27.000Z",
      "content": "How do riches affect our relations to each other? https://bookofmormon.online/war/43"
    },
    {
      "seq": "1195",
      "time": "2022-10-03T10:13:53.000Z",
      "content": "Is this verse parallel to verse 2? Why would Alma begin and end the account of his conversion by reminding Helaman of this scriptural type? https://bookofmormon.online/reign-of-judges/helaman/9"
    },
    {
      "seq": "159",
      "time": "2022-10-03T17:05:19.000Z",
      "content": "What does the word wait mean in “they shall not be ashamed that wait for me”? Does it mean “to await,” “to be quiet” (as in Psalm 62:1), “to serve,” or something else? https://bookofmormon.online/brass-plates/15"
    },
    {
      "seq": "1437",
      "time": "2022-10-03T23:56:45.000Z",
      "content": "Who are the holy ones to whom he refers? https://bookofmormon.online/mormon/48"
    },
    {
      "seq": "1154",
      "time": "2022-10-04T06:48:10.000Z",
      "content": "If the seed is the word, what tree do you think Alma has in mind as the tree that grows from the seed that was planted? (Compare Revelation 2:7; 22:2.) https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "1811",
      "time": "2022-10-04T13:39:36.000Z",
      "content": "Is the wording “received unto baptism” significant? https://bookofmormon.online/moroni/96"
    },
    {
      "seq": "742",
      "time": "2022-10-04T20:31:02.000Z",
      "content": "Abinadi gives us another of the Book of Mormon’s purposes. Why is it important in the latter days for us to know of the wickedness of Noah’s people? https://bookofmormon.online/recolonization/33"
    },
    {
      "seq": "369",
      "time": "2022-10-05T03:22:27.000Z",
      "content": "Because he knows they will not understand, not having been taught to understand this kind of prophecy, Nephi appends his quotation with an explanation. https://bookofmormon.online/nephis-teachings/1"
    },
    {
      "seq": "1198",
      "time": "2022-10-05T10:13:53.000Z",
      "content": "Of what is this verse a prophecy? As used here, what does brightness mean? https://bookofmormon.online/reign-of-judges/helaman/12"
    },
    {
      "seq": "1613",
      "time": "2022-10-05T17:05:19.000Z",
      "content": "If the tent stakes in this scripture are the stakes of the Church, what is the tent? How is the comparison of Church stakes to tent stakes an apt comparison? https://bookofmormon.online/jesus-teachings/41"
    },
    {
      "seq": "311",
      "time": "2022-10-05T23:56:45.000Z",
      "content": "What is the paradise Jacob is talking about? What do we usually call it? https://bookofmormon.online/jacobs-sermon/26"
    },
    {
      "seq": "303",
      "time": "2022-10-06T06:48:10.000Z",
      "content": "Jacob gives us chapter 9 as a commentary on Isaiah 49:22–50:11. But 2 Nephi 9 is a chapter on the Atonement. How is this discussion of the Atonement a commentary on that part of Isaiah? https://bookofmormon.online/jacobs-sermon/20"
    },
    {
      "seq": "1120",
      "time": "2022-10-06T13:39:36.000Z",
      "content": "In philosophy we often use the metaphor of vision to talk about knowledge: to know something is to see it; to be true is to be visible. Is Alma thinking in the same way or in another way? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/9"
    },
    {
      "seq": "40",
      "time": "2022-10-06T20:31:02.000Z",
      "content": "How does Nephi know that the tree is precious (verse 9)? https://bookofmormon.online/lehites/nephis-vision/5"
    },
    {
      "seq": "218",
      "time": "2022-10-07T03:22:27.000Z",
      "content": "Are “hearken unto his great commandments” and “be faithful unto his words” parallel? Does the word hearken suggest anything that obey might not? https://bookofmormon.online/promised-land/lehi/40"
    },
    {
      "seq": "836",
      "time": "2022-10-07T10:13:53.000Z",
      "content": "Not only are the nonmembers forbidden to persecute the members, but the members are forbidden to persecute one another. How might members do that? How might we persecute each other today? https://bookofmormon.online/zarahemla/66"
    },
    {
      "seq": "331",
      "time": "2022-10-07T17:05:19.000Z",
      "content": "Notice that Jacob once again connects learning and wealth in verse 42, as he did in verses 29–30. https://bookofmormon.online/jacobs-sermon/37"
    },
    {
      "seq": "1278",
      "time": "2022-10-07T23:56:45.000Z",
      "content": "How did Moroni prepare his people for war? https://bookofmormon.online/war/63"
    },
    {
      "seq": "1104",
      "time": "2022-10-08T06:48:10.000Z",
      "content": "What does he mean by “poor in heart”? https://bookofmormon.online/reign-of-judges/zoramites/15"
    },
    {
      "seq": "62",
      "time": "2022-10-08T13:39:36.000Z",
      "content": "Do you think that Nephi saw, as Lehi did, his family in his vision? (Compare 1 Nephi 8:14–18.) If so, why doesn’t he mention them? If not, why not? https://bookofmormon.online/lehites/nephis-vision/13"
    },
    {
      "seq": "536",
      "time": "2022-10-08T20:31:02.000Z",
      "content": "The master takes the new shoots to secret places in the garden and plants them to preserve them and their fruit. https://bookofmormon.online/olive-tree/7"
    },
    {
      "seq": "1181",
      "time": "2022-10-09T03:22:27.000Z",
      "content": "Why does Alma pile up the witnesses of Christ? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/45"
    },
    {
      "seq": "282",
      "time": "2022-10-09T10:13:53.000Z",
      "content": "In Isaiah the word law could also be translated “instruction.” Presumably the same is true of whatever Nephite word Jacob used in quoting Isaiah. What does that say about the law? https://bookofmormon.online/jacobs-sermon/14"
    },
    {
      "seq": "686",
      "time": "2022-10-09T17:05:19.000Z",
      "content": "How would the Nephites “continue in the faith of what [they had] heard concerning the coming of [the] Lord”? What does that mean? How would it apply to us? What does the admonition to remember entail? https://bookofmormon.online/benjamin/88"
    },
    {
      "seq": "917",
      "time": "2022-10-09T23:56:45.000Z",
      "content": "Why is it enough to say that the people “humbled themselves and put their trust in the true and living God” and “were faithful until the end” to explain their salvation? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/8"
    },
    {
      "seq": "1410",
      "time": "2022-10-10T06:48:10.000Z",
      "content": "How does envy bring strife, malice, persecution, murder, and all sorts of iniquities? https://bookofmormon.online/samuel/16"
    },
    {
      "seq": "153",
      "time": "2022-10-10T13:39:36.000Z",
      "content": "How is the Lord glorified in Israel? Does this help us understand better what Isaiah said in 1 Nephi 20:9? https://bookofmormon.online/brass-plates/9"
    },
    {
      "seq": "576",
      "time": "2022-10-10T20:31:02.000Z",
      "content": "Omni Why do Omni, Amaron, Chemish, and Abinadom write so little on the plates? And why would Omni confess in the plates his wickedness? Why mention it? https://bookofmormon.online/land-of-nephi/34"
    },
    {
      "seq": "192",
      "time": "2022-10-11T03:22:27.000Z",
      "content": "Does it follow from what Lehi says here that there must be evil acts? https://bookofmormon.online/promised-land/lehi/26"
    },
    {
      "seq": "475",
      "time": "2022-10-11T10:13:53.000Z",
      "content": "Why doesn’t Jacob tell us the name of the man anointed to be king? https://bookofmormon.online/land-of-nephi/11"
    },
    {
      "seq": "9",
      "time": "2022-10-11T17:05:19.000Z",
      "content": "Ending as it does with the total destruction of the Nephites, how does the Book of Mormon show us that the tender mercies of the Lord are over all those chosen because of their faith “to make them mighty even unto the power of deliverance”? https://bookofmormon.online/lehites/10"
    },
    {
      "seq": "1111",
      "time": "2022-10-11T23:56:45.000Z",
      "content": "What beliefs were characteristic of the Zoramites? (See Alma 31:24–28; 31:29). Would those beliefs have been influential with the poor among the Zoramites? https://bookofmormon.online/reign-of-judges/zoramites/21"
    },
    {
      "seq": "1289",
      "time": "2022-10-12T06:48:10.000Z",
      "content": "Given what we’ve seen before in the Book of Mormon, what is surprising about these Nephites? https://bookofmormon.online/war/132"
    },
    {
      "seq": "1295",
      "time": "2022-10-12T13:39:36.000Z",
      "content": "Why do you suppose these people swore by their Maker? It seems very strange to swear by him that you will cover up murder. What is going on? https://bookofmormon.online/war/147"
    },
    {
      "seq": "495",
      "time": "2022-10-12T20:31:02.000Z",
      "content": "How do we seek the kingdom of God? https://bookofmormon.online/jacobs-address/8"
    },
    {
      "seq": "1433",
      "time": "2022-10-13T03:22:27.000Z",
      "content": "Why does he tell us of the existence of other records? Why do we need to know about them? https://bookofmormon.online/mormon/3"
    },
    {
      "seq": "388",
      "time": "2022-10-13T10:13:53.000Z",
      "content": "In the middle of verse 28, Nephi says that “the right way is to believe in Christ and deny him not.” At the beginning of verse 29, he says the same thing. Why is that repetition necessary? https://bookofmormon.online/nephis-teachings/13"
    },
    {
      "seq": "855",
      "time": "2022-10-13T17:05:19.000Z",
      "content": "What does the word creature mean? (Look at the first five letters of the word to see its etymology.) What does it mean to become a new creature? Does being a new creature help explain the use of the passive voice (verse 25)? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "1633",
      "time": "2022-10-13T23:56:45.000Z",
      "content": "What might be included in “all things . . . both great and small”? https://bookofmormon.online/jesus/201"
    },
    {
      "seq": "241",
      "time": "2022-10-14T06:48:10.000Z",
      "content": "How does memory serve Nephi in this verse? How ought it to serve us? https://bookofmormon.online/promised-land/47"
    },
    {
      "seq": "464",
      "time": "2022-10-14T13:39:36.000Z",
      "content": "Why does he add what he says about the Gentiles in this verse when there is nothing comparable in what he says about his people and the Jews? https://bookofmormon.online/nephis-testimony/18"
    },
    {
      "seq": "727",
      "time": "2022-10-14T20:31:02.000Z",
      "content": "Notice the contrast between Noah and Benjamin. Is this comparison intentional or only our inference as readers? What does it show us? https://bookofmormon.online/recolonization/25"
    },
    {
      "seq": "1067",
      "time": "2022-10-15T03:22:27.000Z",
      "content": "Is Ammon using hyperbole here? If not, how can this be true? https://bookofmormon.online/ammon/159"
    },
    {
      "seq": "998",
      "time": "2022-10-15T10:13:53.000Z",
      "content": "What does it mean that their holy calling was “prepared with, and according to” a preparatory redemption? What is a preparatory redemption? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "649",
      "time": "2022-10-15T17:05:19.000Z",
      "content": "Might the joy described here have something to do with the “joy of the saints” mentioned by Enos? How does the experience of Benjamin’s people compare and contrast with Enos’s experience? https://bookofmormon.online/benjamin/61"
    },
    {
      "seq": "76",
      "time": "2022-10-15T23:56:45.000Z",
      "content": "Why would the descendants of Lehi have a different set of twelve judges than the descendants of Israel since, after all, the descendants of Lehi are also descendants of Israel? https://bookofmormon.online/lehites/nephis-vision/24"
    },
    {
      "seq": "1011",
      "time": "2022-10-16T06:48:10.000Z",
      "content": "If Melchizedek was such a great spiritual leader, why do the scriptures say so little about him? Even with modern-day revelation, we know relatively little about him. What lesson might we learn about our own lives from this? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "978",
      "time": "2022-10-16T13:39:36.000Z",
      "content": "How has Zeezrom changed? (How can you tell?) https://bookofmormon.online/reign-of-judges/ammonihah/85"
    },
    {
      "seq": "1549",
      "time": "2022-10-16T20:31:02.000Z",
      "content": "The word end has various meanings, including “cessation of existence,” “final destination,” and “purpose.” Which meaning do you think the Lord means when he says “the law . . . hath an end in me”? https://bookofmormon.online/jesus/103"
    },
    {
      "seq": "1112",
      "time": "2022-10-17T03:22:27.000Z",
      "content": "As you read the rest of Alma’s sermon, ask yourself how he is teaching them wisdom and why humility is necessary to learn it. https://bookofmormon.online/reign-of-judges/zoramites/21"
    },
    {
      "seq": "574",
      "time": "2022-10-17T10:13:53.000Z",
      "content": "What might the Lamanites have meant when they threatened to destroy the traditions of the Nephites’ fathers? What specific fathers would they have had in mind at this date? https://bookofmormon.online/land-of-nephi/35"
    },
    {
      "seq": "492",
      "time": "2022-10-17T17:05:19.000Z",
      "content": "How does listening to the Lord’s commands keep us from pride? How does pride destroy our souls? https://bookofmormon.online/jacobs-address/7"
    },
    {
      "seq": "1121",
      "time": "2022-10-17T23:56:45.000Z",
      "content": "Why does Alma think it important to remind them of these things early in his sermon? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/10"
    },
    {
      "seq": "1430",
      "time": "2022-10-18T06:48:10.000Z",
      "content": "Notice the irony in their question. https://bookofmormon.online/gadianton/110"
    },
    {
      "seq": "987",
      "time": "2022-10-18T13:39:36.000Z",
      "content": "What does it mean to say that life is probationary? Is the word being used as it is when we speak of criminals on probation? If so, is the implication that we have already been convicted? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/3"
    },
    {
      "seq": "135",
      "time": "2022-10-18T20:31:02.000Z",
      "content": "What does this verse mean by “there was not any thing done save it were by his word”? What things is Nephi talking about—what the children of Israel did or what happened to them? What does “by his word” mean in this context? https://bookofmormon.online/lehites/148"
    },
    {
      "seq": "50",
      "time": "2022-10-19T03:22:27.000Z",
      "content": "An angel appears before Nephi (verse 14) and continues the pattern of asking Nephi questions about his beliefs and, now, what he has seen. What is the point of that pattern? https://bookofmormon.online/lehites/nephis-vision/7"
    },
    {
      "seq": "1635",
      "time": "2022-10-19T10:13:53.000Z",
      "content": "What does it mean to say that the earth will be wrapped together like a scroll? https://bookofmormon.online/jesus/203"
    },
    {
      "seq": "161",
      "time": "2022-10-19T17:05:19.000Z",
      "content": "Why is it important for Lehi’s people to know that Jerusalem is shortly to fall? https://bookofmormon.online/promised-land/21"
    },
    {
      "seq": "673",
      "time": "2022-10-19T23:56:45.000Z",
      "content": "To whom does the word beggar refer in this and following verses? Is it the same as “those that stand in need your succor”? https://bookofmormon.online/benjamin/75"
    },
    {
      "seq": "1093",
      "time": "2022-10-20T06:48:10.000Z",
      "content": "Why do Giddonah and the chief judge refuse to respond to Korihor? https://bookofmormon.online/reign-of-judges/korihor/13"
    },
    {
      "seq": "1715",
      "time": "2022-10-20T13:39:36.000Z",
      "content": "Who are the saints who have gone before? What covenant did the Lord make with them? https://bookofmormon.online/moroni/8"
    },
    {
      "seq": "1697",
      "time": "2022-10-20T20:31:02.000Z",
      "content": "What does it mean to say that they are driven as chaff? From where? To where? https://bookofmormon.online/mormon/85"
    },
    {
      "seq": "1266",
      "time": "2022-10-21T03:22:27.000Z",
      "content": "Why does Moroni stop the battle? What’s the point? https://bookofmormon.online/war/21"
    },
    {
      "seq": "1621",
      "time": "2022-10-21T10:13:53.000Z",
      "content": "What are the things we should search? What does it mean to search diligently? How would we search scriptures diligently? (In other words, are we commanded here to read them or to do something more?) For what should we search? https://bookofmormon.online/jesus-teachings/48"
    },
    {
      "seq": "421",
      "time": "2022-10-21T17:05:19.000Z",
      "content": "When will the kingdom of the devil shake? Will it shake with its power or be shaken by something external to it? Who is in the kingdom of the devil? (Review 1 Nephi 14:10 in context.) https://bookofmormon.online/nephis-teachings/46"
    },
    {
      "seq": "1146",
      "time": "2022-10-21T23:56:45.000Z",
      "content": "Here Alma speaks of planting the seed rather than letting it be planted. Why do you think he may have changed his metaphor? What does it mean to know that the word—the seed—is good? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/20"
    },
    {
      "seq": "1322",
      "time": "2022-10-22T06:48:10.000Z",
      "content": "Lehi was Nephi’s father, but Helaman seems to have named his first son Nephi and his second son Lehi. What might this say about how the Nephites think of Lehi and Nephi? https://bookofmormon.online/gadianton/30"
    },
    {
      "seq": "1143",
      "time": "2022-10-22T13:39:36.000Z",
      "content": "When Alma says “it will begin to swell within your breasts,” is your singular or plural? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/16"
    },
    {
      "seq": "1805",
      "time": "2022-10-22T20:31:02.000Z",
      "content": "What does “the endurance of faith” mean? Does it mean that faith produces endurance? If so, how might that be so? ( Ether 12 may be relevant.) https://bookofmormon.online/moroni/92"
    },
    {
      "seq": "935",
      "time": "2022-10-23T03:22:27.000Z",
      "content": "Why does the verse end with “for the Lord God hath spoken it”? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/20"
    },
    {
      "seq": "1022",
      "time": "2022-10-23T10:13:53.000Z",
      "content": "Why does being an instrument require patient suffering? What does “patient suffering in Christ” or “good example in Christ” mean? How would that differ from mere patient suffering or good example? https://bookofmormon.online/ammon/2"
    },
    {
      "seq": "1314",
      "time": "2022-10-23T17:05:19.000Z",
      "content": "What does it mean to land souls? Why use the word soul rather than something else, such as people? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "498",
      "time": "2022-10-23T23:56:45.000Z",
      "content": "Jacob doesn’t just say that pride is bad; he says it is an abomination. Why? https://bookofmormon.online/jacobs-address/9"
    },
    {
      "seq": "588",
      "time": "2022-10-24T06:48:10.000Z",
      "content": "Without the scriptures we cannot know the mysteries of God. What is a mystery? If we can assume that the scriptures contain those mysteries, what are they? https://bookofmormon.online/zarahemla/16"
    },
    {
      "seq": "1092",
      "time": "2022-10-24T13:39:36.000Z",
      "content": "Korihor says that the people dare “not make use of that which is their own” for fear of the priests. Something has to have been happening that Korihor could interpret in that way. To what might he be referring? https://bookofmormon.online/reign-of-judges/korihor/12"
    },
    {
      "seq": "677",
      "time": "2022-10-24T20:31:02.000Z",
      "content": "We must impart of our substance because the Father imparts of his. What does substance mean in this case? Why use that word rather than wealth or something similar? https://bookofmormon.online/benjamin/79"
    },
    {
      "seq": "1182",
      "time": "2022-10-25T03:22:27.000Z",
      "content": "How does his sermon compare, at this point, to his refutation of Korihor ( Alma 30:40–44, especially verse 44)? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/45"
    },
    {
      "seq": "299",
      "time": "2022-10-25T10:13:53.000Z",
      "content": "Notice that the first part of verse 24 is a repetition of the first part of verse 9. Who was speaking in verse 9? Who is speaking in verse 24? The prophet? The Lord? Israel? https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "350",
      "time": "2022-10-25T17:05:19.000Z",
      "content": "What does it mean for something to typify another thing? Nephi says that everything typifies Christ. What does that mean? How, for example, does the natural world typify him? How do we go about seeing everything else as typifying Christ? https://bookofmormon.online/land-of-nephi/8"
    },
    {
      "seq": "553",
      "time": "2022-10-25T23:56:45.000Z",
      "content": "Why does this story follow the allegory of the olive tree? What is the thematic connection? https://bookofmormon.online/land-of-nephi/29"
    },
    {
      "seq": "1047",
      "time": "2022-10-26T06:48:10.000Z",
      "content": "Do we have wicked traditions that we have inherited? If so, can you think of some examples? Do those traditions interfere with our ability to see others as our brothers and sisters? https://bookofmormon.online/aaron/37"
    },
    {
      "seq": "592",
      "time": "2022-10-26T13:39:36.000Z",
      "content": "King Benjamin says that he wants to do two things: give the people a ruler and give them a name. Since he is about to die, it is fairly clear why he wants to do the former, but why would he want to do the latter? What is the significance? https://bookofmormon.online/zarahemla/20"
    },
    {
      "seq": "1071",
      "time": "2022-10-26T20:31:02.000Z",
      "content": "What does it mean to say that the Lord grants “unto men according to their desire”? Does that suggest anything about the nature of reward and punishment in the gospel? https://bookofmormon.online/reign-of-judges/87"
    },
    {
      "seq": "901",
      "time": "2022-10-27T03:22:27.000Z",
      "content": "Why do you think the writer felt it so important to record these two verses? https://bookofmormon.online/reign-of-judges/13"
    },
    {
      "seq": "1376",
      "time": "2022-10-27T10:13:53.000Z",
      "content": "Why might the Lord begin as he does, saying, “Thou art Nephi, and I am God”? https://bookofmormon.online/nephi/56"
    },
    {
      "seq": "1332",
      "time": "2022-10-27T17:05:19.000Z",
      "content": "What kinds of ideas might we infer from Helaman’s metaphor of a foundation built on rock? Do you see any meaning in the contrast between the Lord as a rock and Satan as a storm? https://bookofmormon.online/gadianton/44"
    },
    {
      "seq": "1829",
      "time": "2022-10-27T23:56:45.000Z",
      "content": "Why does knowing the truth of the Book of Mormon require (1) a sincere heart, (2) real intent, and (3) faith in Christ? If these verses are written specifically for the Lamanites, what justifies our use of them for everyone? https://bookofmormon.online/moroni/102"
    },
    {
      "seq": "768",
      "time": "2022-10-28T06:48:10.000Z",
      "content": "Why does Isaiah say that Christ isn’t someone we will find attractive? Notice that it isn’t the world who won’t find him attractive; it is we who will not. https://bookofmormon.online/recolonization/abinadi/22"
    },
    {
      "seq": "1043",
      "time": "2022-10-28T13:39:36.000Z",
      "content": "What does it mean to say that no human being can merit anything of himself? https://bookofmormon.online/aaron/25"
    },
    {
      "seq": "1493",
      "time": "2022-10-28T20:31:02.000Z",
      "content": "What are other words that mean the same as blessed? https://bookofmormon.online/jesus/66"
    },
    {
      "seq": "1072",
      "time": "2022-10-29T03:22:27.000Z",
      "content": "How does this verse qualify what Alma taught in verse 4? https://bookofmormon.online/reign-of-judges/87"
    },
    {
      "seq": "1647",
      "time": "2022-10-29T10:13:53.000Z",
      "content": "What does the phrase “that I might draw all men unto me” imply? Why use the word draw? https://bookofmormon.online/jesus/219"
    },
    {
      "seq": "786",
      "time": "2022-10-29T17:05:19.000Z",
      "content": "Why does Abinadi give this overview of the quotation from Isaiah? Which things does he focus on? Why those? https://bookofmormon.online/recolonization/abinadi/33"
    },
    {
      "seq": "208",
      "time": "2022-10-29T23:56:45.000Z",
      "content": "Isn’t there a sense in which this is a restatement of verse 23? If so, each might help us understand the other. Does this verse tell us what Adam intended to do in falling or what the Lord intended him to do? https://bookofmormon.online/promised-land/lehi/37"
    },
    {
      "seq": "326",
      "time": "2022-10-30T06:48:10.000Z",
      "content": "In what sense is this verse the culmination of the list that began in verse 28? https://bookofmormon.online/jacobs-sermon/34"
    },
    {
      "seq": "358",
      "time": "2022-10-30T13:39:36.000Z",
      "content": "Why does Isaiah focus on Christ as a child? https://bookofmormon.online/isaiah/52"
    },
    {
      "seq": "1279",
      "time": "2022-10-30T20:31:02.000Z",
      "content": "What characteristics of Moroni do we see here? What, for example, does it mean to say that he was a man like Ammon? https://bookofmormon.online/war/64"
    },
    {
      "seq": "233",
      "time": "2022-10-31T03:22:27.000Z",
      "content": "What do you make of Lehi’s explanation of his children’s rebellion? What do you make of the self-sacrifice implicit in Lehi’s promise? https://bookofmormon.online/promised-land/lehi/73"
    },
    {
      "seq": "1415",
      "time": "2022-10-31T10:13:53.000Z",
      "content": "What might prevent these things from being written? https://bookofmormon.online/samuel/28"
    },
    {
      "seq": "37",
      "time": "2022-10-31T17:05:19.000Z",
      "content": "Before Lehi saw the tree, he went through a dark and dreary space and a large and spacious field ( 1 Nephi 8:7–9). Why do you think those things are omitted from Nephi’s experience? https://bookofmormon.online/lehites/nephis-vision/5"
    },
    {
      "seq": "532",
      "time": "2022-10-31T23:56:45.000Z",
      "content": "It sends out new shoots, but the top dies. https://bookofmormon.online/olive-tree/4"
    },
    {
      "seq": "1137",
      "time": "2022-11-01T06:48:10.000Z",
      "content": "Alma uses the terms good and true as equivalents when he speaks of the seed. We usually use true and accurate as equivalents. What do you make of his usage? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/16"
    },
    {
      "seq": "1777",
      "time": "2022-11-01T13:39:36.000Z",
      "content": "How does remembering that trust is a synonym for faith help make what Moroni says more intelligible? For example, why would faith require that we hope for something not seen? https://bookofmormon.online/moroni/67"
    },
    {
      "seq": "480",
      "time": "2022-11-01T20:31:02.000Z",
      "content": "What does this verse tell us about the polygamy of David and Solomon? https://bookofmormon.online/land-of-nephi/13"
    },
    {
      "seq": "1607",
      "time": "2022-11-02T03:22:27.000Z",
      "content": "What are our graven images today? What are the works of our hands? https://bookofmormon.online/jesus-teachings/34"
    },
    {
      "seq": "614",
      "time": "2022-11-02T10:13:53.000Z",
      "content": "In what sense do our bodies belong to the Creator? What does that mean to us? https://bookofmormon.online/benjamin/18"
    },
    {
      "seq": "178",
      "time": "2022-11-02T17:05:19.000Z",
      "content": "What are the ends of the law? Ends usually means “purposes.” Does it mean that here? What does “to answer the ends of the law” mean? https://bookofmormon.online/promised-land/lehi/21"
    },
    {
      "seq": "330",
      "time": "2022-11-02T23:56:45.000Z",
      "content": "As you read through these verses, focus on the various types or symbols Jacob uses. What do they show us? How do they connect his prophecy to other prophecies, specifically to what he has quoted from Isaiah? https://bookofmormon.online/jacobs-sermon/37"
    },
    {
      "seq": "1184",
      "time": "2022-11-03T06:48:10.000Z",
      "content": "In the previous chapter, Alma used the metaphor of the seed. Now he uses the metaphor of looking around. What does this metaphor teach us about coming to know the truth—in other words, the good? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/47"
    },
    {
      "seq": "1685",
      "time": "2022-11-03T13:39:36.000Z",
      "content": "To what is he referring when he says he will be lifted up at the last day? How does that contrast with the sorrow he has felt his whole life? https://bookofmormon.online/downfall/39"
    },
    {
      "seq": "907",
      "time": "2022-11-03T20:31:02.000Z",
      "content": "What kind of inequality begins to come among the people? What causes it? How is that inequality related to the sins we saw described in verses 6 and 8? https://bookofmormon.online/reign-of-judges/47"
    },
    {
      "seq": "59",
      "time": "2022-11-04T03:22:27.000Z",
      "content": "How is verse 24 related to the verses that precede it? For example, does it explain what the angel says in verse 23? https://bookofmormon.online/lehites/nephis-vision/11"
    },
    {
      "seq": "970",
      "time": "2022-11-04T10:13:53.000Z",
      "content": "This verse speaks of something that God cannot do. How does it explain that limitation on his power? https://bookofmormon.online/reign-of-judges/ammonihah/71"
    },
    {
      "seq": "144",
      "time": "2022-11-04T17:05:19.000Z",
      "content": "How does Israel remember its covenant? How does the Lord remember his? https://bookofmormon.online/promised-land/19"
    },
    {
      "seq": "879",
      "time": "2022-11-04T23:56:45.000Z",
      "content": "Mosiah tells us that the problem with kings is that sometimes they are unjust. How does having judges instead of kings ameliorate this problem? (Compare verses 28–29.) https://bookofmormon.online/zarahemla/95"
    },
    {
      "seq": "1459",
      "time": "2022-11-05T06:48:10.000Z",
      "content": "Of what will he heal those who repent? https://bookofmormon.online/jesus/21"
    },
    {
      "seq": "1406",
      "time": "2022-11-05T13:39:36.000Z",
      "content": "He says that they are cursed and their riches are cursed because they have set their hearts on riches. It may be relatively easy to understand how they are cursed for having their hearts so set, but how are their riches cursed? https://bookofmormon.online/samuel/15"
    },
    {
      "seq": "78",
      "time": "2022-11-05T20:31:02.000Z",
      "content": "The manuscript of the Book of Mormon says “even the sword of the justice of God” rather than “even the word of the justice of God,” as we now have it. How would that change the meaning of this verse, if it does? https://bookofmormon.online/lehites/nephis-vision/27"
    },
    {
      "seq": "296",
      "time": "2022-11-06T03:22:27.000Z",
      "content": "In verse 20, the “head” of the streets means the street corners. Does rebuke help us understand the meaning of fury in the previous clause? https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "804",
      "time": "2022-11-06T10:13:53.000Z",
      "content": "How does this relate to Abinadi’s quotation of Isaiah 53? https://bookofmormon.online/recolonization/50"
    },
    {
      "seq": "113",
      "time": "2022-11-06T17:05:19.000Z",
      "content": "Nephi’s brothers tell him that the things he has said are too hard to bear (verse 1). What have they heard that has caused that response? https://bookofmormon.online/lehites/109"
    },
    {
      "seq": "647",
      "time": "2022-11-06T23:56:45.000Z",
      "content": "Is there any significance to the description they give of Christ at the end of the verse? https://bookofmormon.online/benjamin/60"
    },
    {
      "seq": "854",
      "time": "2022-11-07T06:48:10.000Z",
      "content": "Why is the word changed—in the phrase “changed from their carnal and fallen state, to a state of righteousness”—passive? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "1269",
      "time": "2022-11-07T13:39:36.000Z",
      "content": "How can liberty bind one to his land and country? https://bookofmormon.online/war/26"
    },
    {
      "seq": "1159",
      "time": "2022-11-07T20:31:02.000Z",
      "content": "Is ye in verse 38 singular or plural? What does the verse mean if it is singular? If it is plural? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "640",
      "time": "2022-11-08T03:22:27.000Z",
      "content": "How do you understand the word only here? Does it mean “except,” as in some older usages? https://bookofmormon.online/benjamin/53"
    },
    {
      "seq": "1780",
      "time": "2022-11-08T10:13:53.000Z",
      "content": "What heavenly gift is Moroni speaking of? https://bookofmormon.online/moroni/69"
    },
    {
      "seq": "1554",
      "time": "2022-11-08T17:05:19.000Z",
      "content": "In what ways are they weak? https://bookofmormon.online/jesus/115"
    },
    {
      "seq": "1368",
      "time": "2022-11-08T23:56:45.000Z",
      "content": "To what does the phrase “these things” refer? https://bookofmormon.online/nephi/25"
    },
    {
      "seq": "1558",
      "time": "2022-11-09T06:48:10.000Z",
      "content": "Why is the blessing of the children interrupted by Jesus’s prayer? The story implies some connection between the children coming to him and his groaning within himself for Israel. What’s the connection? https://bookofmormon.online/jesus/118"
    },
    {
      "seq": "185",
      "time": "2022-11-09T13:39:36.000Z",
      "content": "What meaning does the phrase “unto God” add to “firstfruits”? Lehi tells us that Christ is the firstfruits inasmuch as, or because, he intercedes. How does his intercession make him the firstfruits? https://bookofmormon.online/promised-land/lehi/23"
    },
    {
      "seq": "361",
      "time": "2022-11-09T20:31:02.000Z",
      "content": "What is an increase of government? https://bookofmormon.online/isaiah/52"
    },
    {
      "seq": "1610",
      "time": "2022-11-10T03:22:27.000Z",
      "content": "What does it mean that the power of heaven will come down among them? https://bookofmormon.online/jesus-teachings/36"
    },
    {
      "seq": "1419",
      "time": "2022-11-10T10:13:53.000Z",
      "content": "Notice that Samuel says “if you believe on Christ, you will repent” instead of “if you believe, you ought to repent.” Why does he put it that way? Is it possible to believe on Christ and not repent? Why not? https://bookofmormon.online/samuel/32"
    },
    {
      "seq": "1676",
      "time": "2022-11-10T17:05:19.000Z",
      "content": "What does Mormon mean when he says he “tasted and knew of the goodness of Jesus”? What might that metaphor say to us? https://bookofmormon.online/downfall/31"
    },
    {
      "seq": "1688",
      "time": "2022-11-10T23:56:45.000Z",
      "content": "What was “without faith”? Mormon’s prayer? If so, why was he praying so long for them? Why would a person pray all day long for another, but without faith? https://bookofmormon.online/downfall/87"
    },
    {
      "seq": "460",
      "time": "2022-11-11T06:48:10.000Z",
      "content": "Is Nephi describing his own people here or warning them of what might happen to them by telling them what has happened to many people? https://bookofmormon.online/nephis-testimony/16"
    },
    {
      "seq": "1354",
      "time": "2022-11-11T13:39:36.000Z",
      "content": "Here Nephi speaks of the devil as enticing them. Is there a difference between entreat and entice? What might that difference signify? https://bookofmormon.online/nephi/8"
    },
    {
      "seq": "889",
      "time": "2022-11-11T20:31:02.000Z",
      "content": "For what do you think they want each person to have an equal chance? https://bookofmormon.online/zarahemla/102"
    },
    {
      "seq": "197",
      "time": "2022-11-12T03:22:27.000Z",
      "content": "Look at each step in the chain of this argument. Can you explain why each step is true? For example, why is it that if there is no righteousness, then there is no happiness? https://bookofmormon.online/promised-land/lehi/29"
    },
    {
      "seq": "1788",
      "time": "2022-11-12T10:13:53.000Z",
      "content": "What does it mean to say that the Savior is the “fountain of all righteousness”? What does the word fountain mean here? https://bookofmormon.online/moroni/76"
    },
    {
      "seq": "692",
      "time": "2022-11-12T17:05:19.000Z",
      "content": "To what does “this great knowledge” refer? Why is it important that faith has taught them? https://bookofmormon.online/benjamin/91"
    },
    {
      "seq": "777",
      "time": "2022-11-12T23:56:45.000Z",
      "content": "By making himself an offering for sin, the Savior will see his children. Can you explain straightforwardly what this means? What does it mean about becoming a child of God? https://bookofmormon.online/recolonization/abinadi/28"
    },
    {
      "seq": "125",
      "time": "2022-11-13T06:48:10.000Z",
      "content": "Nephi himself draws a lesson from the Liahona: “by small means the Lord can bring about great things.” Why might the Lord choose to work by small means? What are some of the small means in your own life that have brought about great ends? https://bookofmormon.online/lehites/124"
    },
    {
      "seq": "1310",
      "time": "2022-11-13T13:39:36.000Z",
      "content": "What does it mean to say that God’s word is quick and powerful? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "658",
      "time": "2022-11-13T20:31:02.000Z",
      "content": "Why do we need to remember his goodness and long-suffering, especially in relation to our unworthiness? https://bookofmormon.online/benjamin/70"
    },
    {
      "seq": "833",
      "time": "2022-11-14T03:22:27.000Z",
      "content": "What is a covenant? (It is more than a contract or mutual promise.) What does this covenant mean? What does it mean to have eternal life? https://bookofmormon.online/zarahemla/59"
    },
    {
      "seq": "173",
      "time": "2022-11-14T10:13:53.000Z",
      "content": "What does Lehi mean when he says that men are instructed sufficiently to know good from evil? Where and when do we receive that instruction? When is the law given to us? Is it given to everyone? If so, what does Lehi mean by law here? https://bookofmormon.online/promised-land/lehi/20"
    },
    {
      "seq": "1499",
      "time": "2022-11-14T17:05:19.000Z",
      "content": "The word translated “pure” in the KJV could also have been translated “cleansed.” Is that relevant? What does it mean to have a pure heart? What does it mean to see God? Where do we see God? https://bookofmormon.online/jesus/66"
    },
    {
      "seq": "417",
      "time": "2022-11-14T23:56:45.000Z",
      "content": "Who are the meek and the poor in heart? How are they persecuted? Are there ways in which we persecute the meek and poor in heart? Can you give specific examples of how? https://bookofmormon.online/nephis-teachings/43"
    },
    {
      "seq": "940",
      "time": "2022-11-15T06:48:10.000Z",
      "content": "Does verse 44 tell us what it means to speak plainly—to testify—or does Alma speak plainly because he has been called to testify? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/26"
    },
    {
      "seq": "788",
      "time": "2022-11-15T13:39:36.000Z",
      "content": "Notice that Abinadi returns to the scripture they asked him to explain. Why does he do so now? https://bookofmormon.online/recolonization/abinadi/40"
    },
    {
      "seq": "1418",
      "time": "2022-11-15T20:31:02.000Z",
      "content": "What does it mean to believe on the Savior? We usually speak of believing in him. Is believing on him different, or is that just a difference between the older language of the Book of Mormon and our own language? https://bookofmormon.online/samuel/32"
    },
    {
      "seq": "750",
      "time": "2022-11-16T03:22:27.000Z",
      "content": "Abinadi has claimed to be a prophet, and they have asked him to explain the words of another, rather difficult prophet. That seems quite a natural thing to do; why does Abinadi condemn them for it? https://bookofmormon.online/recolonization/38"
    },
    {
      "seq": "1747",
      "time": "2022-11-16T10:13:53.000Z",
      "content": "What does it mean to say that the Lord made this promise “in his wrath”? https://bookofmormon.online/jaredites/12"
    },
    {
      "seq": "44",
      "time": "2022-11-16T17:05:19.000Z",
      "content": "Why does Nephi tell us that he spoke with the Spirit as one person speaks with another? How is that relevant to this particular story? https://bookofmormon.online/lehites/nephis-vision/6"
    },
    {
      "seq": "1578",
      "time": "2022-11-16T23:56:45.000Z",
      "content": "Hadn’t the twelve been baptized? If not, why not? If so, why are they baptized again? https://bookofmormon.online/jesus/153"
    },
    {
      "seq": "1324",
      "time": "2022-11-17T06:48:10.000Z",
      "content": "They have trampled under foot the laws of Mosiah. What were those laws? Where do we find them? How do you think they have trampled them under foot? https://bookofmormon.online/gadianton/32"
    },
    {
      "seq": "463",
      "time": "2022-11-17T13:39:36.000Z",
      "content": "Why does Nephi add the note about Jews at the end of this verse? How is his own background relevant to understanding this note? https://bookofmormon.online/nephis-testimony/18"
    },
    {
      "seq": "874",
      "time": "2022-11-17T20:31:02.000Z",
      "content": "How are verses 28–29 (and, therefore, also verse 3) a type for what Alma says in this verse? https://bookofmormon.online/reign-of-judges/helaman/10"
    },
    {
      "seq": "789",
      "time": "2022-11-18T03:22:27.000Z",
      "content": "What does the image of beautiful feet suggest? Why is it repeated? What changes occur from one repetition to the next? Are those changes relevant? https://bookofmormon.online/recolonization/abinadi/40"
    },
    {
      "seq": "1743",
      "time": "2022-11-18T10:13:53.000Z",
      "content": "Why does Moroni keep mentioning his imperfections and those of the other writers? What imperfections does he seem to have in mind? Shouldn’t he be more self-confident, have a better self-image? https://bookofmormon.online/moroni/30"
    },
    {
      "seq": "1394",
      "time": "2022-11-18T17:05:19.000Z",
      "content": "What does the phrase “restored unto grace for grace” mean? https://bookofmormon.online/mormon/42"
    },
    {
      "seq": "924",
      "time": "2022-11-18T23:56:45.000Z",
      "content": "Are the questions that Alma asks in these verses different questions, or are they different ways of asking the same question? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/9"
    },
    {
      "seq": "542",
      "time": "2022-11-19T06:48:10.000Z",
      "content": "When they check the transplanted trees, they discover that they too all bear bad fruit. The good branch of the tree that brought forth mixed fruit has withered away. https://bookofmormon.online/olive-tree/28"
    },
    {
      "seq": "951",
      "time": "2022-11-19T13:39:36.000Z",
      "content": "If the Gideonites were living righteously, why did they have to be awakened to a sense of their duty to God? https://bookofmormon.online/reign-of-judges/gideon/15"
    },
    {
      "seq": "451",
      "time": "2022-11-19T20:31:02.000Z",
      "content": "Why does Nephi say this doctrine is “the only and true doctrine”? What do the words only and true each mean that helps us understand his point when they are put together? https://bookofmormon.online/nephis-testimony/10"
    },
    {
      "seq": "179",
      "time": "2022-11-20T03:22:27.000Z",
      "content": "Why does Lehi tell us that we must have a broken heart and a contrite spirit to partake in Christ’s redemption? Why doesn’t he mention obedience or ordinances if they are necessary? https://bookofmormon.online/promised-land/lehi/21"
    },
    {
      "seq": "1049",
      "time": "2022-11-20T10:13:53.000Z",
      "content": "Why are their weapons of war called “weapons of rebellion”? Against whom were they rebelling? The Nephites? They warred against them, but would that be called rebellion? https://bookofmormon.online/aaron/40"
    },
    {
      "seq": "1202",
      "time": "2022-11-20T17:05:19.000Z",
      "content": "What twenty-four plates is Alma referring to? (See Mosiah 8:9.) Why are those plates so important to the Nephites? How is that the same as, or different from, the way in which the Book of Mormon is important to us? https://bookofmormon.online/reign-of-judges/helaman/19"
    },
    {
      "seq": "707",
      "time": "2022-11-20T23:56:45.000Z",
      "content": "What does it mean to have the Savior’s name written in our hearts? https://bookofmormon.online/benjamin/98"
    },
    {
      "seq": "364",
      "time": "2022-11-21T06:48:10.000Z",
      "content": "What is coming on David’s throne and kingdom? How will that order his kingdom? (Some translators use establish instead of order—and uphold instead of establish.) https://bookofmormon.online/isaiah/52"
    },
    {
      "seq": "1803",
      "time": "2022-11-21T13:39:36.000Z",
      "content": "These verses suggest that the authority to give the gift of the Holy Ghost was the most important aspect of the disciples’ ordination. Why might that be? https://bookofmormon.online/moroni/91"
    },
    {
      "seq": "660",
      "time": "2022-11-21T20:31:02.000Z",
      "content": "What does it mean to be humbled to the depths? (Haven’t we seen an example in this chapter?) Why is that necessary? https://bookofmormon.online/benjamin/70"
    },
    {
      "seq": "31",
      "time": "2022-11-22T03:22:27.000Z",
      "content": "The Spirit already knows the answers to the questions that he asks Nephi in verses 2–4, so why does he ask? https://bookofmormon.online/lehites/nephis-vision/2"
    },
    {
      "seq": "1798",
      "time": "2022-11-22T10:13:53.000Z",
      "content": "What does it mean to know one’s weaknesses? How do we discover them? https://bookofmormon.online/moroni/79"
    },
    {
      "seq": "546",
      "time": "2022-11-22T17:05:19.000Z",
      "content": "The master orders that the trees be dug about and nourished one more, final time. https://bookofmormon.online/olive-tree/38"
    },
    {
      "seq": "1220",
      "time": "2022-11-22T23:56:45.000Z",
      "content": "Is Alma using “deny the Holy Ghost” and “murder against the light” as synonyms in this verse? https://bookofmormon.online/reign-of-judges/corianton/2"
    },
    {
      "seq": "1563",
      "time": "2022-11-23T06:48:10.000Z",
      "content": "In what sense or senses were those who ate the bread filled? https://bookofmormon.online/jesus/125"
    },
    {
      "seq": "1439",
      "time": "2022-11-23T13:39:36.000Z",
      "content": "Mormon said he was making an end in verse 19, but he continues. How might you explain this? https://bookofmormon.online/mormon/51"
    },
    {
      "seq": "1591",
      "time": "2022-11-23T20:31:02.000Z",
      "content": "Who are the Gentiles? https://bookofmormon.online/jesus/112"
    },
    {
      "seq": "21",
      "time": "2022-11-24T03:22:27.000Z",
      "content": "The plates contain the five books of Moses, a chronicle of the history of Judah, and a collection of prophecies, including those of Jeremiah. How will those preserve the commandments for Lehi’s descendants? https://bookofmormon.online/lehites/65"
    },
    {
      "seq": "1526",
      "time": "2022-11-24T10:13:53.000Z",
      "content": "These two proscriptions are parallel. Why do you think that is so? Against what is Jesus warning in them? To whom is he referring when he speaks of “the heathen”? https://bookofmormon.online/jesus/79"
    },
    {
      "seq": "1102",
      "time": "2022-11-24T17:05:19.000Z",
      "content": "Mormon stops to editorialize, to tell us the conclusion he draws from this story. How was that conclusion relevant to his time? How is it relevant to ours? https://bookofmormon.online/reign-of-judges/korihor/34"
    },
    {
      "seq": "830",
      "time": "2022-11-24T23:56:45.000Z",
      "content": "What does it mean that Alma’s people shall be the Lord’s people? How does this tie in with King Benjamin’s sermon? Does it help explain why that sermon was so important? How is it important to us? https://bookofmormon.online/zarahemla/58"
    },
    {
      "seq": "148",
      "time": "2022-11-25T06:48:10.000Z",
      "content": "When the Lord says “for my name’s sake I will defer mine anger,” what is he saying? https://bookofmormon.online/brass-plates/3"
    },
    {
      "seq": "12",
      "time": "2022-11-25T13:39:36.000Z",
      "content": "What is the difference between Nephi’s belief and Sam’s? Compare D&C 46:14. Does that difference necessarily say anything about the faith of either of them? https://bookofmormon.online/lehites/17"
    },
    {
      "seq": "984",
      "time": "2022-11-25T20:31:02.000Z",
      "content": "What does it mean to die in sin? Does the word in carry any particular weight? https://bookofmormon.online/reign-of-judges/ammonihah/94"
    },
    {
      "seq": "1683",
      "time": "2022-11-26T03:22:27.000Z",
      "content": "Why do they wish to die but struggle for their lives at the same time? https://bookofmormon.online/downfall/38"
    },
    {
      "seq": "1567",
      "time": "2022-11-26T10:13:53.000Z",
      "content": "To what does the phrase“these things” refer? https://bookofmormon.online/jesus/131"
    },
    {
      "seq": "52",
      "time": "2022-11-26T17:05:19.000Z",
      "content": "How is Nephi’s answer, “I know that he loveth his children,” an answer to the angel’s question (verse 17)? https://bookofmormon.online/lehites/nephis-vision/9"
    },
    {
      "seq": "717",
      "time": "2022-11-26T23:56:45.000Z",
      "content": "What does the word consecrated mean? Why would a king be consecrated? https://bookofmormon.online/zarahemla/34"
    },
    {
      "seq": "304",
      "time": "2022-11-27T06:48:10.000Z",
      "content": "Why has Jacob read this passage from Isaiah to the Nephites? How will it help them to know that Israel will be restored in the last days? How could they apply this passage to themselves? How can we apply it to ourselves? https://bookofmormon.online/jacobs-sermon/20"
    },
    {
      "seq": "56",
      "time": "2022-11-27T13:39:36.000Z",
      "content": "Having shown Nephi the birth of Jesus, the angel asks (verse 21) whether Nephi now understands the meaning of the tree. How is the birth of Christ the interpretation of or explanation of the tree? https://bookofmormon.online/lehites/nephis-vision/11"
    },
    {
      "seq": "778",
      "time": "2022-11-27T20:31:02.000Z",
      "content": "This is an important point of focus for Abinadi in chapter 15. With what other scriptures can you connect it? Mosiah 5:7? 1 John 3:2? Others? https://bookofmormon.online/recolonization/abinadi/28"
    },
    {
      "seq": "1252",
      "time": "2022-11-28T03:22:27.000Z",
      "content": "Who can escape having their deeds restored to them? If we are restored to righteousness, to whose righteousness are we restored? https://bookofmormon.online/reign-of-judges/corianton/39"
    },
    {
      "seq": "903",
      "time": "2022-11-28T10:13:53.000Z",
      "content": "What is significant about Alma’s prayer? How does his intent differ from that of Amlici? https://bookofmormon.online/reign-of-judges/29"
    },
    {
      "seq": "1030",
      "time": "2022-11-28T17:05:19.000Z",
      "content": "Why does Lamoni refer to those who’ve been stealing his flocks as “my brethren”? https://bookofmormon.online/ammon/39"
    },
    {
      "seq": "948",
      "time": "2022-11-28T23:56:45.000Z",
      "content": "Does Alma’s message to the Gideonites differ from his message to those of Zarahemla? https://bookofmormon.online/reign-of-judges/gideon/5"
    },
    {
      "seq": "1789",
      "time": "2022-11-29T06:48:10.000Z",
      "content": "What does it mean to be comforted? (Here, again, a look at a historical dictionary may be helpful.) How would these words have been a comfort to Moroni? Which words does he mean by “these words”? https://bookofmormon.online/moroni/77"
    },
    {
      "seq": "257",
      "time": "2022-11-29T13:39:36.000Z",
      "content": "How could the Nephites depend on one person, Nephi, for safety? What does it mean to say that he was their protector? https://bookofmormon.online/jacobs-sermon/1"
    },
    {
      "seq": "17",
      "time": "2022-11-29T20:31:02.000Z",
      "content": "How is keeping the commandments faithfully connected to being chosen for deliverance because of faith ( 1 Nephi 1:20)? https://bookofmormon.online/lehites/30"
    },
    {
      "seq": "1232",
      "time": "2022-11-30T03:22:27.000Z",
      "content": "What does the term outer darkness mean in other scriptures? (See Matthew 8:12; 22:13; 25:30; and D&C 101:91; 133:73.) To what does it refer here? https://bookofmormon.online/reign-of-judges/corianton/12"
    },
    {
      "seq": "572",
      "time": "2022-11-30T10:13:53.000Z",
      "content": "Why does Enos imagine the possibility about which he is concerned—that the Nephites will be destroyed and the Lamanites will not? What do you think might motivate that particular concern? https://bookofmormon.online/land-of-nephi/33"
    },
    {
      "seq": "400",
      "time": "2022-11-30T17:05:19.000Z",
      "content": "In verse 25 we see Nephi use a phrase from Isaiah: “buy milk and honey without money and without price.” What is the significance of milk and honey? What is the significance of buying it “without price”? https://bookofmormon.online/nephis-teachings/22"
    },
    {
      "seq": "684",
      "time": "2022-11-30T23:56:45.000Z",
      "content": "How is this admonition related to those which have come before? Particularly to the admonition about beggars? https://bookofmormon.online/benjamin/87"
    },
    {
      "seq": "1191",
      "time": "2022-12-01T06:48:10.000Z",
      "content": "Compare Alma 5:23 and Matthew 10:28—what does it mean to destroy both soul (i.e., spirit) and body in hell? https://bookofmormon.online/zarahemla/74"
    },
    {
      "seq": "346",
      "time": "2022-12-01T13:39:36.000Z",
      "content": "In verse 20, does Jacob assume that he is on an island? https://bookofmormon.online/jacobs-sermon/50"
    },
    {
      "seq": "1305",
      "time": "2022-12-01T20:31:02.000Z",
      "content": "What caused the dissensions mentioned? Does the migration of Lehi’s family (and others) parallel this migration, or is this a group of dissidents leaving? https://bookofmormon.online/gadianton/10"
    },
    {
      "seq": "393",
      "time": "2022-12-02T03:22:27.000Z",
      "content": "What is their stumbling block? https://bookofmormon.online/nephis-teachings/21"
    },
    {
      "seq": "212",
      "time": "2022-12-02T10:13:53.000Z",
      "content": "In this verse Lehi returns to a theme he took up in verses 6–10: the Messiah. Why was the interlude in verses 11–26 necessary? https://bookofmormon.online/promised-land/lehi/38"
    },
    {
      "seq": "859",
      "time": "2022-12-02T17:05:19.000Z",
      "content": "What does he mean when he says, “I am snatched”? Why does he put that in the present tense rather than the past? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "808",
      "time": "2022-12-02T23:56:45.000Z",
      "content": "What doctrinal teachings has Alma learned from Abinadi’s sermons? https://bookofmormon.online/alma/1"
    },
    {
      "seq": "1337",
      "time": "2022-12-03T06:48:10.000Z",
      "content": "What does it mean to “cry . . . until ye shall have faith”? Do we see anything like this earlier in the Book of Mormon? What would such a cry require? https://bookofmormon.online/gadianton/62"
    },
    {
      "seq": "989",
      "time": "2022-12-03T13:39:36.000Z",
      "content": "These verses seem to answer the immediately previous questions. How? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/6"
    },
    {
      "seq": "101",
      "time": "2022-12-03T20:31:02.000Z",
      "content": "What is the marvelous work to which the angel refers here? Is it the Restoration? The Second Coming? Something else? Does it have a definite reference, or is it a scripture that can have more than one meaning? https://bookofmormon.online/lehites/nephis-vision/47"
    },
    {
      "seq": "64",
      "time": "2022-12-04T03:22:27.000Z",
      "content": "Is there any particular reason that the name “Lamb of God” is used in this context? https://bookofmormon.online/lehites/nephis-vision/14"
    },
    {
      "seq": "271",
      "time": "2022-12-04T10:13:53.000Z",
      "content": "Who was absent? Who didn’t hear him? https://bookofmormon.online/jacobs-sermon/9"
    },
    {
      "seq": "586",
      "time": "2022-12-04T17:05:19.000Z",
      "content": "Notice that once again a Book of Mormon writer mentions a father teaching his children in “all the language of his fathers.” The theme is a relatively important one. What might it mean to us? https://bookofmormon.online/zarahemla/15"
    },
    {
      "seq": "1636",
      "time": "2022-12-04T23:56:45.000Z",
      "content": "How will the things we have, a small part of Jesus’s teaching, try our faith? Are there specific things in Jesus’s Sermon on the Mount/Sermon at the Temple that try our faith? https://bookofmormon.online/jesus/205"
    },
    {
      "seq": "1274",
      "time": "2022-12-05T06:48:10.000Z",
      "content": "How did dissensions come about among the Nephites? Are there similar dissensions among us? If not, could they happen? https://bookofmormon.online/war/43"
    },
    {
      "seq": "990",
      "time": "2022-12-05T13:39:36.000Z",
      "content": "Why is Gods capitalized in this verse? Usually it is capitalized only when it is used as the name of Deity, not when it is used to refer to an office or position. In what ways are we like Gods? Why is that significant? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/10"
    },
    {
      "seq": "1338",
      "time": "2022-12-05T20:31:02.000Z",
      "content": "What is the difference in the voice now? Is that difference a difference of the voice itself or a difference in its hearers? https://bookofmormon.online/gadianton/67"
    },
    {
      "seq": "1236",
      "time": "2022-12-06T03:22:27.000Z",
      "content": "What does it mean to be restored? We say that the Church has been restored. Alma says that the spirit will be restored to the body. We talk about ill people being restored to health. What does that word imply? https://bookofmormon.online/reign-of-judges/corianton/17"
    },
    {
      "seq": "871",
      "time": "2022-12-06T10:13:53.000Z",
      "content": "Since Alma is here telling us about the pains he experienced, what can he mean when he says, “I could remember my pains no more”? https://bookofmormon.online/zarahemla/77"
    },
    {
      "seq": "934",
      "time": "2022-12-06T17:05:19.000Z",
      "content": "Who are the workers of iniquity? Is iniquity different from sin? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/20"
    },
    {
      "seq": "865",
      "time": "2022-12-06T23:56:45.000Z",
      "content": "What is the significance of what Alma asks Helaman to remember? (Compare Mosiah 27:16.) https://bookofmormon.online/reign-of-judges/helaman/1"
    },
    {
      "seq": "1398",
      "time": "2022-12-07T06:48:10.000Z",
      "content": "Does the Lord threaten the Nephites through Samuel, telling them to “repent or else”? If so, how do we understand such a threat? How does it differ from bullying? If not, how are we to understand this kind of prophecy? https://bookofmormon.online/gadianton/96"
    },
    {
      "seq": "316",
      "time": "2022-12-07T13:39:36.000Z",
      "content": "Why is the cross an important symbol in the Book of Mormon? https://bookofmormon.online/jacobs-sermon/28"
    },
    {
      "seq": "941",
      "time": "2022-12-07T20:31:02.000Z",
      "content": "To what does the phrase “these things” here and in verse 45 refer? Is its antecedent in verse 44? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/27"
    },
    {
      "seq": "835",
      "time": "2022-12-08T03:22:27.000Z",
      "content": "This verse suggests that we are to take the word of the person who tells us that he or she has repented. Why? https://bookofmormon.online/zarahemla/61"
    },
    {
      "seq": "1272",
      "time": "2022-12-08T10:13:53.000Z",
      "content": "Moroni seems to behave very oddly in these circumstances. He lets them go if they promise to leave him and his people alone! What makes him think he can trust them? https://bookofmormon.online/war/32"
    },
    {
      "seq": "1127",
      "time": "2022-12-08T17:05:19.000Z",
      "content": "What does Amulek remind them about their background? Why is that important? https://bookofmormon.online/reign-of-judges/zoramites/15"
    },
    {
      "seq": "1094",
      "time": "2022-12-08T23:56:45.000Z",
      "content": "Why does Alma respond only to the accusation that he and the other priests glut themselves on the labors of the people? https://bookofmormon.online/reign-of-judges/korihor/15"
    },
    {
      "seq": "985",
      "time": "2022-12-09T06:48:10.000Z",
      "content": "Why is it a punishment to continue to live in our sins? How does this square with the discussion of everlasting punishment in Doctrine and Covenants 19? Do you think Alma knew of the explanation we see in the D&C? https://bookofmormon.online/reign-of-judges/ammonihah/95"
    },
    {
      "seq": "136",
      "time": "2022-12-09T13:39:36.000Z",
      "content": "What does it mean to esteem—to value—all flesh as one but to favor the righteous? How do esteem and favor differ? https://bookofmormon.online/lehites/150"
    },
    {
      "seq": "605",
      "time": "2022-12-09T20:31:02.000Z",
      "content": "Why is peace a gift from God? (Does that mean, then, that we should expect not to have continual peace?) https://bookofmormon.online/benjamin/13"
    },
    {
      "seq": "491",
      "time": "2022-12-10T03:22:27.000Z",
      "content": "What is pride of the heart (verse 16)? Is it a different kind of pride, or is this just another way to speak of what we usually describe as pride? https://bookofmormon.online/jacobs-address/7"
    },
    {
      "seq": "63",
      "time": "2022-12-10T10:13:53.000Z",
      "content": "Why are the vision of Christ’s birth (verses 17–23) and the vision of his life (verses 27–34) both preceded by the angel describing them to Nephi as “the condescension of God”? In other words, why does verse 26 repeat verse 16? https://bookofmormon.online/lehites/nephis-vision/14"
    },
    {
      "seq": "1581",
      "time": "2022-12-10T17:05:19.000Z",
      "content": "How does Jesus’s prayer here relate to the context in which it occurs? In other words, why, in this particular context, does he pray that the Holy Ghost will be given to all believers? https://bookofmormon.online/jesus/160"
    },
    {
      "seq": "908",
      "time": "2022-12-10T23:56:45.000Z",
      "content": "What does the last part of this verse suggest we must do if we wish to see peace in the world? How is this related to Alma’s teaching in Mosiah 18:9? Does Alma imply that other things are unnecessary? https://bookofmormon.online/reign-of-judges/49"
    },
    {
      "seq": "785",
      "time": "2022-12-11T06:48:10.000Z",
      "content": "More difficult: why does being conceived by the power of God make him the Father? And why are they the Eternal Father? https://bookofmormon.online/recolonization/abinadi/32"
    },
    {
      "seq": "569",
      "time": "2022-12-11T13:39:36.000Z",
      "content": "How is the Lord’s promise an answer to Enos’s prayer? This is the same promise that has been given all along. How is it an answer to his concerns for their welfare? https://bookofmormon.online/land-of-nephi/33"
    },
    {
      "seq": "1783",
      "time": "2022-12-11T20:31:02.000Z",
      "content": "What is grace? What does it mean to be meek? (A look at a historical dictionary would be helpful here, perhaps the Oxford English Dictionary or Webster’s 1828 dictionary.) https://bookofmormon.online/moroni/76"
    },
    {
      "seq": "1665",
      "time": "2022-12-12T03:22:27.000Z",
      "content": "How is it that having all things in common makes them all free? https://bookofmormon.online/mormon/69"
    },
    {
      "seq": "1551",
      "time": "2022-12-12T10:13:53.000Z",
      "content": "What does this suggest about whom the Lord has been speaking to up to this point? https://bookofmormon.online/jesus/105"
    },
    {
      "seq": "539",
      "time": "2022-12-12T17:05:19.000Z",
      "content": "The master commands the servant to cut off the branches that do not bear good fruit and to burn them. https://bookofmormon.online/olive-tree/19"
    },
    {
      "seq": "664",
      "time": "2022-12-12T23:56:45.000Z",
      "content": "be filled with the love of God (is this his love for us or our love for him?) https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1608",
      "time": "2022-12-13T06:48:10.000Z",
      "content": "What are the “groves” that will be removed from our cities? In ancient Israel, some pagans worshipped in sacred groves. What might be comparable? https://bookofmormon.online/jesus-teachings/34"
    },
    {
      "seq": "618",
      "time": "2022-12-13T13:39:36.000Z",
      "content": "What does it mean to give God everything we are? https://bookofmormon.online/benjamin/27"
    },
    {
      "seq": "1441",
      "time": "2022-12-13T20:31:02.000Z",
      "content": "How can knowledge bring salvation? Isn’t something more needed? Or, perhaps, is he using knowledge differently than we might expect? https://bookofmormon.online/mormon/51"
    },
    {
      "seq": "1020",
      "time": "2022-12-14T03:22:27.000Z",
      "content": "What does this verse suggest about what it means to preach “with power and authority of God”? https://bookofmormon.online/reign-of-judges/74"
    },
    {
      "seq": "1823",
      "time": "2022-12-14T10:13:53.000Z",
      "content": "Compare Moroni 10:25. Why might this theme have been so important to father and son? https://bookofmormon.online/downfall/49"
    },
    {
      "seq": "1277",
      "time": "2022-12-14T17:05:19.000Z",
      "content": "Mormon seems to be interjecting his commentary in the abridgment at this point. Compare what he says to Doctrine and Covenants 98:9–10. What does this say about our own times? About our responsibilities to government? https://bookofmormon.online/war/48"
    },
    {
      "seq": "620",
      "time": "2022-12-14T23:56:45.000Z",
      "content": "What do you think moves Benjamin to make the transition to the topic of this chapter, Christ’s coming in the flesh? Is there something in what he has just been discussing that points in that direction? In other words, what’s the connection? https://bookofmormon.online/benjamin/35"
    },
    {
      "seq": "1138",
      "time": "2022-12-15T06:48:10.000Z",
      "content": "How would Korihor have understood true? (Compare Alma 30:13–16.) What difference does that make? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/16"
    },
    {
      "seq": "956",
      "time": "2022-12-15T13:39:36.000Z",
      "content": "Alma communes with angels from time to time. Why, then, does he also have to “ wrestle with God in prayer” (italics added)? https://bookofmormon.online/reign-of-judges/ammonihah/2"
    },
    {
      "seq": "806",
      "time": "2022-12-15T20:31:02.000Z",
      "content": "In what sense wouldn’t Abinadi deny the commandments? He wouldn’t deny his testimony or the truthfulness of the prophecies, but what does it mean to say that he wouldn’t deny the commandments? https://bookofmormon.online/recolonization/50"
    },
    {
      "seq": "1161",
      "time": "2022-12-16T03:22:27.000Z",
      "content": "Can what causes the tree to grow in our lives also kill it? How? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "1476",
      "time": "2022-12-16T10:13:53.000Z",
      "content": "Why does he say, “I have suffered the will of the Father” rather than “I have done the will of the Father”? Does that difference have any implications for us? https://bookofmormon.online/jesus/43"
    },
    {
      "seq": "371",
      "time": "2022-12-16T17:05:19.000Z",
      "content": "To whom are the prophecies of Isaiah plain? What does that say about the Nephites? What does it say about us? https://bookofmormon.online/nephis-teachings/2"
    },
    {
      "seq": "967",
      "time": "2022-12-16T23:56:45.000Z",
      "content": "Why might Zeezrom begin with such an obvious and insulting temptation? Why not begin with something more subtle? https://bookofmormon.online/reign-of-judges/ammonihah/62"
    },
    {
      "seq": "1221",
      "time": "2022-12-17T06:48:10.000Z",
      "content": "See if you can explain the teaching of this verse in your own words. Why did Alma think it necessary to explain this to Corianton? How is it relevant to us? https://bookofmormon.online/reign-of-judges/corianton/2"
    },
    {
      "seq": "1167",
      "time": "2022-12-17T13:39:36.000Z",
      "content": "Compare Nephi’s description of the fruit of the tree of life ( 1 Nephi 8:10–12) with Eve’s description of the tree of knowledge ( Genesis 3:6; Moses 4:12). Does that suggest an answer? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/27"
    },
    {
      "seq": "1710",
      "time": "2022-12-17T20:31:02.000Z",
      "content": "What are the greater things that those who believe the Book of Mormon will know? https://bookofmormon.online/moroni/2"
    },
    {
      "seq": "1241",
      "time": "2022-12-18T03:22:27.000Z",
      "content": "How does Alma’s use of the word restoration help us understand such things as the resurrection and the judgment? Does it give us any insight into the restoration of the Church? https://bookofmormon.online/reign-of-judges/corianton/23"
    },
    {
      "seq": "1222",
      "time": "2022-12-18T10:13:53.000Z",
      "content": "What does it mean to harrow up a person’s soul? When is it good for a soul to be harrowed? Think about what a harrow does. How do we do that to a soul? Who has the right to harrow another’s soul? https://bookofmormon.online/reign-of-judges/corianton/3"
    },
    {
      "seq": "938",
      "time": "2022-12-18T17:05:19.000Z",
      "content": "What does it mean to be a child of the devil? Does that tell us anything about what it means to be a child of God and the Good Shepherd? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/25"
    },
    {
      "seq": "736",
      "time": "2022-12-18T23:56:45.000Z",
      "content": "What does the Lord mean when he says he is jealous? Is that only metaphorical, or does he feel jealousy? Is there another alternative? https://bookofmormon.online/recolonization/30"
    },
    {
      "seq": "610",
      "time": "2022-12-19T06:48:10.000Z",
      "content": "We owe him our lives. Is this a repetition of what Benjamin said in verses 20 and 21? https://bookofmormon.online/benjamin/16"
    },
    {
      "seq": "1203",
      "time": "2022-12-19T13:39:36.000Z",
      "content": "These interpreters have been made available so that God can “bring forth out of darkness unto light all their secret works and their abominations.” Why must those things be revealed? Why isn’t it enough to reveal the truths of the gospel? https://bookofmormon.online/reign-of-judges/helaman/20"
    },
    {
      "seq": "947",
      "time": "2022-12-19T20:31:02.000Z",
      "content": "In these verses Alma makes it clear that he hopes the Gideonites are different than the people in Zarahemla were. Are they? https://bookofmormon.online/reign-of-judges/gideon/2"
    },
    {
      "seq": "32",
      "time": "2022-12-20T03:22:27.000Z",
      "content": "Having asked Nephi what he wants and what he believes, the Spirit then praises God before proceeding with the revelation (verse 6). Why? https://bookofmormon.online/lehites/nephis-vision/2"
    },
    {
      "seq": "652",
      "time": "2022-12-20T10:13:53.000Z",
      "content": "Notice that there are no other requirements for salvation than the three listed. But what about repentance? Ordinances? Did Benjamin leave them off the list, or are they included somehow? https://bookofmormon.online/benjamin/67"
    },
    {
      "seq": "933",
      "time": "2022-12-20T17:05:19.000Z",
      "content": "What mockery or persecution within the church might Alma have in mind? (Compare Alma 1:22–24; how did the contention with those outside the church lead to excommunications?) https://bookofmormon.online/reign-of-judges/zarahemla-sermon/19"
    },
    {
      "seq": "663",
      "time": "2022-12-20T23:56:45.000Z",
      "content": "If we do the things Benjamin has described, we will: always rejoice (even in the midst of difficulty?) https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1705",
      "time": "2022-12-21T06:48:10.000Z",
      "content": "Notice the number of times this is repeated, each time more fully than the last: here in verse 3 and also in verses 5, 8, and 10. What do you make of that repetition? https://bookofmormon.online/mormon/91"
    },
    {
      "seq": "446",
      "time": "2022-12-21T13:39:36.000Z",
      "content": "How does one deny Christ? https://bookofmormon.online/nephis-testimony/7"
    },
    {
      "seq": "389",
      "time": "2022-12-21T20:31:02.000Z",
      "content": "What does it mean to bow down to Christ? How do we do that in our lives now? What does worship mean here? What does it mean to be “cast out”? https://bookofmormon.online/nephis-teachings/13"
    },
    {
      "seq": "163",
      "time": "2022-12-22T03:22:27.000Z",
      "content": "What definition of the devil’s kingdom does Nephi give here? How is it relevant to the vision he had of the abominable church? https://bookofmormon.online/promised-land/36"
    },
    {
      "seq": "1100",
      "time": "2022-12-22T10:13:53.000Z",
      "content": "He says that he taught Satan’s words so long that, in the end, he believed they were true. How does that happen to us? https://bookofmormon.online/reign-of-judges/korihor/27"
    },
    {
      "seq": "1619",
      "time": "2022-12-22T17:05:19.000Z",
      "content": "Does “shall be taught of the Lord” mean “will be taught by the Lord” or “will be taught about the Lord”? https://bookofmormon.online/jesus-teachings/45"
    },
    {
      "seq": "693",
      "time": "2022-12-22T23:56:45.000Z",
      "content": "At what times do we enter into a similar covenant, to do the will of God and to be obedient to his commandments? https://bookofmormon.online/benjamin/91"
    },
    {
      "seq": "453",
      "time": "2022-12-23T06:48:10.000Z",
      "content": "To what does “these words” refer? https://bookofmormon.online/nephis-testimony/12"
    },
    {
      "seq": "616",
      "time": "2022-12-23T13:39:36.000Z",
      "content": "I suspect the contentions Benjamin has in mind are like the contentions between the Lamanites and Nephites. But how might this verse apply to us? What kinds of contentions are we susceptible to? https://bookofmormon.online/benjamin/25"
    },
    {
      "seq": "775",
      "time": "2022-12-23T20:31:02.000Z",
      "content": "What does the clause “who shall declare his generation?” mean? Some have taken this to ask, “Who will convince [or explain him to] his generation?” What do you think? https://bookofmormon.online/recolonization/abinadi/27"
    },
    {
      "seq": "1339",
      "time": "2022-12-24T03:22:27.000Z",
      "content": "Why does the voice mention that the Savior “was from the foundation of the world?” (Does this use of the word foundation have anything to do with the use in verse 12?) What was he from the foundation of the world? https://bookofmormon.online/gadianton/67"
    },
    {
      "seq": "1634",
      "time": "2022-12-24T10:13:53.000Z",
      "content": "What scriptures has he given them that they didn’t have before? https://bookofmormon.online/jesus/202"
    },
    {
      "seq": "1291",
      "time": "2022-12-24T17:05:19.000Z",
      "content": "Why is this material important to the Book of Mormon narrative? Why is it important to us? https://bookofmormon.online/war/136"
    },
    {
      "seq": "1745",
      "time": "2022-12-24T23:56:45.000Z",
      "content": "Why do you think the brother of Jared isn’t mentioned by name? What might account for the omission of the name of such a great prophet? https://bookofmormon.online/jaredites/4"
    },
    {
      "seq": "1276",
      "time": "2022-12-25T06:48:10.000Z",
      "content": "In what ways was Amalickiah a threat to the Nephites? https://bookofmormon.online/war/45"
    },
    {
      "seq": "396",
      "time": "2022-12-25T13:39:36.000Z",
      "content": "What does “grind upon the face of the poor” mean? (This is Nephi’s variation of a phrase from Isaiah. See Isaiah 3:15 and 2 Nephi 13:15.) How and when do we do that? https://bookofmormon.online/nephis-teachings/21"
    },
    {
      "seq": "1360",
      "time": "2022-12-25T20:31:02.000Z",
      "content": "Why is pride such a terrible sin? The Book of Mormon condemns pride consistently, but what is wrong with pride? https://bookofmormon.online/nephi/14"
    },
    {
      "seq": "27",
      "time": "2022-12-26T03:22:27.000Z",
      "content": "Compare the personage who responds to Nephi’s desire with the one who responded to Lehi ( 1 Nephi 1:5–6). Are they the same being? https://bookofmormon.online/lehites/96"
    },
    {
      "seq": "68",
      "time": "2022-12-26T10:13:53.000Z",
      "content": "Why does the vision include this relatively lengthy description of the physical and psychological healings that Jesus did? How were they important to his mission of salvation? https://bookofmormon.online/lehites/nephis-vision/17"
    },
    {
      "seq": "521",
      "time": "2022-12-26T17:05:19.000Z",
      "content": "How does this verse answer the questions I asked about in verses 4–5? How did Jacob and those like him get the faith that he describes here? https://bookofmormon.online/land-of-nephi/19"
    },
    {
      "seq": "1650",
      "time": "2022-12-26T23:56:45.000Z",
      "content": "How does this verse square with latter-day revelation to the effect that the punishment of the wicked is not eternal burnings? (See D&C 19:6ff.) https://bookofmormon.online/jesus/220"
    },
    {
      "seq": "1711",
      "time": "2022-12-27T06:48:10.000Z",
      "content": "What two reasons does Moroni give here for the coming forth of the Book of Mormon? https://bookofmormon.online/moroni/4"
    },
    {
      "seq": "339",
      "time": "2022-12-27T13:39:36.000Z",
      "content": "In what sense is this a repetition of everything that has been said in the last several chapters? https://bookofmormon.online/jacobs-sermon/42"
    },
    {
      "seq": "486",
      "time": "2022-12-27T20:31:02.000Z",
      "content": "Why do you think he describes the Lord as “the all-powerful Creator of heaven and earth”? What does that description of the Lord emphasize? How is that emphasis appropriate to the circumstances in which he is preaching? https://bookofmormon.online/jacobs-address/3"
    },
    {
      "seq": "131",
      "time": "2022-12-28T03:22:27.000Z",
      "content": "What does the Lord mean when he says, “ After ye have arrived in the promised land, ye shall know that I, the Lord, am God”? Doesn’t Nephi already know that? https://bookofmormon.online/lehites/135"
    },
    {
      "seq": "1737",
      "time": "2022-12-28T10:13:53.000Z",
      "content": "What does it mean to “begin as in times of old”? https://bookofmormon.online/moroni/28"
    },
    {
      "seq": "1060",
      "time": "2022-12-28T17:05:19.000Z",
      "content": "Why do the unconverted Lamanites leave off killing the Anti-Nephi-Lehies and turn on the Nephites? https://bookofmormon.online/ammon/125"
    },
    {
      "seq": "545",
      "time": "2022-12-28T23:56:45.000Z",
      "content": "In order to save the roots, the master and the servant remove the worst of the branches of the old, grafted tree and graft the natural branches back in. Then they graft branches from the old tree onto the transplanted trees. https://bookofmormon.online/olive-tree/34"
    },
    {
      "seq": "570",
      "time": "2022-12-29T06:48:10.000Z",
      "content": "In verse 4, he prayed for his own soul; in verse 9, he prayed for his family (presumably the Nephites); now he prays for the Lamanites. Is it a series of steps or a progression of some kind? Why does he call the Lamanites “my brethren”? https://bookofmormon.online/land-of-nephi/33"
    },
    {
      "seq": "729",
      "time": "2022-12-29T13:39:36.000Z",
      "content": "In our days, what might the cultural equivalent of King Noah’s priests be? How do they flatter us to idolatry? https://bookofmormon.online/recolonization/25"
    },
    {
      "seq": "757",
      "time": "2022-12-29T20:31:02.000Z",
      "content": "Why does Abinadi read the scriptures to them? What has that to do with the scriptures not being written in their hearts? https://bookofmormon.online/recolonization/abinadi/1"
    },
    {
      "seq": "1826",
      "time": "2022-12-30T03:22:27.000Z",
      "content": "At the end of verse 45, Mormon says that charity endures all things. Then, at the beginning of verse 47, he says that it endures forever. Is there a connection between these? If so, what is it? https://bookofmormon.online/downfall/65"
    },
    {
      "seq": "1145",
      "time": "2022-12-30T10:13:53.000Z",
      "content": "The word sure means not only “without a doubt,” but “secure, safe.” Which of those meanings do you think is most important here? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/19"
    },
    {
      "seq": "718",
      "time": "2022-12-30T17:05:19.000Z",
      "content": "What does “stirred up” mean in this context? Why did the people need to be stirred up to remember the covenant? https://bookofmormon.online/zarahemla/34"
    },
    {
      "seq": "1586",
      "time": "2022-12-30T23:56:45.000Z",
      "content": "Compare this prayer to John 17, especially 17:9–10. What does it mean that Jesus doesn’t pray for the world? Doesn’t he love everyone? https://bookofmormon.online/jesus/164"
    },
    {
      "seq": "1487",
      "time": "2022-12-31T06:48:10.000Z",
      "content": "We have one understanding of what this verse requires of us, but what might it have meant to those listening to him speak? https://bookofmormon.online/jesus/62"
    },
    {
      "seq": "1096",
      "time": "2022-12-31T13:39:36.000Z",
      "content": "Is Korihor backing down a little here, or is he merely saying the same thing he said in verse 15—namely, that he believes only what can be seen? https://bookofmormon.online/reign-of-judges/korihor/18"
    },
    {
      "seq": "1056",
      "time": "2022-12-31T20:31:02.000Z",
      "content": "What is the significance of this testimony? What does bearing this testimony require if it is to continue to be a true testimony? https://bookofmormon.online/ammon/117"
    },
    {
      "seq": "116",
      "time": "2023-01-01T03:22:27.000Z",
      "content": "Why does the Lord wait until only the night before to tell Lehi when they will leave (verse 9)? https://bookofmormon.online/lehites/112"
    },
    {
      "seq": "1485",
      "time": "2023-01-01T10:13:53.000Z",
      "content": "The doctrine of Christ taught here is to be our spiritual foundation, and teachings that are more or less than that doctrine have an evil origin. What would be an example of a teaching that is more than that doctrine? Less? https://bookofmormon.online/jesus/60"
    },
    {
      "seq": "745",
      "time": "2023-01-01T17:05:19.000Z",
      "content": "Why would a group feel it necessary to tell their leader, “We are strong, we shall not come into bondage”? Does their need to bolster their confidence say something about them? https://bookofmormon.online/recolonization/34"
    },
    {
      "seq": "782",
      "time": "2023-01-01T23:56:45.000Z",
      "content": "What does the sermon that follows have to do with the Isaiah passage that Abinadi has just read to them? https://bookofmormon.online/recolonization/abinadi/31"
    },
    {
      "seq": "348",
      "time": "2023-01-02T06:48:10.000Z",
      "content": "What does Jacob mean when he says that it is only in and through the grace of God that we are saved after we are reconciled? How have we seen that explained in the previous chapters? https://bookofmormon.online/jacobs-sermon/51"
    },
    {
      "seq": "469",
      "time": "2023-01-02T13:39:36.000Z",
      "content": "What things did Jacob tell Nephi he should write about? Why that and not the history of his people? Later Mormon includes more of what we would call history rather than making it a record of sacred things only. Why? https://bookofmormon.online/land-of-nephi/9"
    },
    {
      "seq": "1440",
      "time": "2023-01-02T20:31:02.000Z",
      "content": "What does it mean to be a pure descendant of Lehi? Why do you think Mormon mentions this? https://bookofmormon.online/mormon/51"
    },
    {
      "seq": "456",
      "time": "2023-01-03T03:22:27.000Z",
      "content": "If knowledge is given in plainness, what need is there to search it? https://bookofmormon.online/nephis-testimony/13"
    },
    {
      "seq": "656",
      "time": "2023-01-03T10:13:53.000Z",
      "content": "Why does he say “retain in remembrance” rather than “remember”? What does the first add to our understanding? https://bookofmormon.online/benjamin/70"
    },
    {
      "seq": "705",
      "time": "2023-01-03T17:05:19.000Z",
      "content": "We are accustomed to hearing that our names will be blotted from the Lord’s records if we transgress and do not repent, but what Benjamin says here is unusual. What does it mean to have Christ’s name blotted out of our hearts? https://bookofmormon.online/benjamin/97"
    },
    {
      "seq": "1790",
      "time": "2023-01-03T23:56:45.000Z",
      "content": "Moroni illustrates the idea of faith with examples. How might these examples of faith have served to comfort him? What purpose or purposes do they serve for us? https://bookofmormon.online/moroni/77"
    },
    {
      "seq": "1612",
      "time": "2023-01-04T06:48:10.000Z",
      "content": "What does this verse mean? https://bookofmormon.online/jesus-teachings/41"
    },
    {
      "seq": "1218",
      "time": "2023-01-04T13:39:36.000Z",
      "content": "Does Alma say that Corianton has been guilty of unchastity? https://bookofmormon.online/reign-of-judges/corianton/1"
    },
    {
      "seq": "703",
      "time": "2023-01-04T20:31:02.000Z",
      "content": "Are the children of Christ the only ones who will know the name by which they are called, as this seems to imply? https://bookofmormon.online/benjamin/95"
    },
    {
      "seq": "661",
      "time": "2023-01-05T03:22:27.000Z",
      "content": "What is it that “is to come, which was spoken by the mouth of the angel”? (Remember the beginning verses of chapter 3.) In whom or what must our faith remain steadfast? https://bookofmormon.online/benjamin/70"
    },
    {
      "seq": "188",
      "time": "2023-01-05T10:13:53.000Z",
      "content": "According to this verse, what are the ends of the law? https://bookofmormon.online/promised-land/lehi/24"
    },
    {
      "seq": "558",
      "time": "2023-01-05T17:05:19.000Z",
      "content": "In verse 2, why does Enos describe his experience as a wrestle with God? Does he perhaps have Jacob’s wrestle with the Lord (or one of his messengers) in mind (see also Genesis 32:24–26)? https://bookofmormon.online/land-of-nephi/29"
    },
    {
      "seq": "1382",
      "time": "2023-01-05T23:56:45.000Z",
      "content": "What points of doctrine do you think they might have disputed? Is there anything we’ve read or that you know is coming up that might suggest an answer to this question? https://bookofmormon.online/nephi/72"
    },
    {
      "seq": "1308",
      "time": "2023-01-06T06:48:10.000Z",
      "content": "What does it mean to call on the name of the Lord? How is the Lord merciful to those who call on his name? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "425",
      "time": "2023-01-06T13:39:36.000Z",
      "content": "Can believing Latter-day Saints be duped in the manner described in this verse? How? https://bookofmormon.online/nephis-teachings/47"
    },
    {
      "seq": "722",
      "time": "2023-01-06T20:31:02.000Z",
      "content": "There is a great deal of moving about in the Book of Mormon, especially in these chapters. These scriptures may help you figure out the migrations. https://bookofmormon.online/zarahemla/34"
    },
    {
      "seq": "328",
      "time": "2023-01-07T03:22:27.000Z",
      "content": "Compare this verse to Romans 8:6 and 1 Corinthians 2:11–16. What does it mean to be “carnally-minded”? To be “spiritually-minded”? https://bookofmormon.online/jacobs-sermon/35"
    },
    {
      "seq": "869",
      "time": "2023-01-07T10:13:53.000Z",
      "content": "Why does Alma’s cry in verse 18 bring the results in verse 19? How is this connected to King Benjamin’s teaching in Mosiah 4? https://bookofmormon.online/zarahemla/77"
    },
    {
      "seq": "1502",
      "time": "2023-01-07T17:05:19.000Z",
      "content": "Do verses 13 and 14 teach the same thing, or does each teach something different? Compare 3 Nephi 18:24 to verses 15–16; verse 16 seems to explain the other verses in this group. What does verse 16 teach us about good works? https://bookofmormon.online/jesus/67"
    },
    {
      "seq": "999",
      "time": "2023-01-07T23:56:45.000Z",
      "content": "What does it mean to be hard-hearted? To be blind of mind? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1658",
      "time": "2023-01-08T06:48:10.000Z",
      "content": "Why does the Book of Mormon tell us this story—including the story of those who ask to come to his kingdom speedily as well as the story of the Three Nephites? https://bookofmormon.online/jesus/229"
    },
    {
      "seq": "1520",
      "time": "2023-01-08T13:39:36.000Z",
      "content": "James speaks of the double-minded person ( James 1:8). What does it mean to be double minded? In contrast, what does it mean to be whole? https://bookofmormon.online/jesus/78"
    },
    {
      "seq": "1773",
      "time": "2023-01-08T20:31:02.000Z",
      "content": "What might have caused Moroni to think of three witnesses as he transcribes the book of Ether? https://bookofmormon.online/moroni/58"
    },
    {
      "seq": "88",
      "time": "2023-01-09T03:22:27.000Z",
      "content": "How do you suppose the abominable church has taken away the plain and precious things and the covenants? Does the angel’s earlier description of the church give any clues? https://bookofmormon.online/lehites/nephis-vision/39"
    },
    {
      "seq": "1839",
      "time": "2023-01-09T10:13:53.000Z",
      "content": "Why does Moroni say “be perfected in him” (passive voice) rather than “perfect yourselves in him”? Does the rest of the verse answer that question? https://bookofmormon.online/moroni/116"
    },
    {
      "seq": "1119",
      "time": "2023-01-09T17:05:19.000Z",
      "content": "What does the word perfect mean as Alma is using it here? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/9"
    },
    {
      "seq": "1761",
      "time": "2023-01-09T23:56:45.000Z",
      "content": "How would one contend against the Lord’s word? https://bookofmormon.online/moroni/45"
    },
    {
      "seq": "341",
      "time": "2023-01-10T06:48:10.000Z",
      "content": "Is Jacob drawing a parallel between covenants and condescensions? If so, what does that parallel teach us? https://bookofmormon.online/jacobs-sermon/42"
    },
    {
      "seq": "408",
      "time": "2023-01-10T13:39:36.000Z",
      "content": "What is fear toward the Lord? (Notice that 2 Nephi 27:34 suggests that sanctify and fear may have similar meanings.) What are the precepts of men? What would it mean to have our fear of the Lord taught by the precepts of men? https://bookofmormon.online/nephis-teachings/35"
    },
    {
      "seq": "1158",
      "time": "2023-01-10T20:31:02.000Z",
      "content": "What is the fruit of the tree? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "375",
      "time": "2023-01-11T03:22:27.000Z",
      "content": "What does Nephi mean when he speaks of “my plainness”? His plainness compared to what? How does he describe his plainness, and why is that description important? https://bookofmormon.online/nephis-teachings/4"
    },
    {
      "seq": "1802",
      "time": "2023-01-11T10:13:53.000Z",
      "content": "Why weren’t these words part of the public record of Christ’s visit? Why does Moroni include them in the Book of Mormon? https://bookofmormon.online/moroni/91"
    },
    {
      "seq": "302",
      "time": "2023-01-11T17:05:19.000Z",
      "content": "Has Jacob used the chapters from Isaiah the way we might expect him to use them? We take them to be prophecies of Christ’s coming. How does he use them? https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "485",
      "time": "2023-01-11T23:56:45.000Z",
      "content": "When Jacob says “as yet, ye have been obedient unto the word of the Lord,” does that contradict what he said in verses 15–16 of chapter 1 or what he says in verse 5 of this chapter? https://bookofmormon.online/jacobs-address/3"
    },
    {
      "seq": "332",
      "time": "2023-01-12T06:48:10.000Z",
      "content": "Might Jacob’s shaking of his garment have anything to do with 2 Nephi 8:23, 25 and 9:14? https://bookofmormon.online/jacobs-sermon/38"
    },
    {
      "seq": "1185",
      "time": "2023-01-12T13:39:36.000Z",
      "content": "Alma returns to his metaphor of the seed, taking his audience back to the beginning of his sermon. Why does he feel the need to take them back to the beginning? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/49"
    },
    {
      "seq": "516",
      "time": "2023-01-12T20:31:02.000Z",
      "content": "Why does Jacob tell us of the difficulty of writing on the plates and that the Book of Mormon writers can write only a little? https://bookofmormon.online/land-of-nephi/15"
    },
    {
      "seq": "1364",
      "time": "2023-01-13T03:22:27.000Z",
      "content": "How do these judges’ motives and methods compare to the motives and methods of the priests of Noah? https://bookofmormon.online/nephi/19"
    },
    {
      "seq": "217",
      "time": "2023-01-13T10:13:53.000Z",
      "content": "Earlier Lehi referred to Christ as the Redeemer. Now he refers to him as the Mediator (here and in verse 27). Why? https://bookofmormon.online/promised-land/lehi/40"
    },
    {
      "seq": "1454",
      "time": "2023-01-13T17:05:19.000Z",
      "content": "What has the daily ministering of angels to do with Nephi’s power to convince these bands of people? How does his ministration to them (verse 17) compare to the angel’s ministration to him? https://bookofmormon.online/gadianton/183"
    },
    {
      "seq": "1045",
      "time": "2023-01-13T23:56:45.000Z",
      "content": "What does “I will give away all my sins” mean? Why use give away rather than forsake, for example? https://bookofmormon.online/aaron/28"
    },
    {
      "seq": "709",
      "time": "2023-01-14T06:48:10.000Z",
      "content": "We cannot even claim our own bodies (2:25), so we necessarily belong to someone, the being by whose name we are called. What does the image used in this verse say about our relation to our master? https://bookofmormon.online/benjamin/100"
    },
    {
      "seq": "288",
      "time": "2023-01-14T13:39:36.000Z",
      "content": "The word translated “comfort” in Isaiah (verse 12) originally meant “strengthen” as well as “soothe.” Does that change your understanding of the verse? https://bookofmormon.online/jacobs-sermon/16"
    },
    {
      "seq": "969",
      "time": "2023-01-14T20:31:02.000Z",
      "content": "What does it mean to save the people in their sins? https://bookofmormon.online/reign-of-judges/ammonihah/69"
    },
    {
      "seq": "1216",
      "time": "2023-01-15T03:22:27.000Z",
      "content": "Why is it important to acknowledge our unworthiness before God at all times? How do we do so? https://bookofmormon.online/reign-of-judges/shiblon/6"
    },
    {
      "seq": "883",
      "time": "2023-01-15T10:13:53.000Z",
      "content": "Does this verse answer the question I asked about verse 26? How are we to understand these verses as they apply to us today? https://bookofmormon.online/zarahemla/99"
    },
    {
      "seq": "714",
      "time": "2023-01-15T17:05:19.000Z",
      "content": "What does it mean that we have them through the Creator’s wisdom, power, justice, and mercy? https://bookofmormon.online/benjamin/101"
    },
    {
      "seq": "1199",
      "time": "2023-01-15T23:56:45.000Z",
      "content": "Why might Alma have thought it necessary to tell Helaman this? https://bookofmormon.online/reign-of-judges/helaman/13"
    },
    {
      "seq": "791",
      "time": "2023-01-16T06:48:10.000Z",
      "content": "Compare this description of the first resurrection to that in the Doctrine and Covenants (e.g., sections 63 and 76). What are the similarities? What do you make of the differences? https://bookofmormon.online/recolonization/abinadi/43"
    },
    {
      "seq": "1825",
      "time": "2023-01-16T13:39:36.000Z",
      "content": "Does Mormon equate being meek with having faith? https://bookofmormon.online/downfall/62"
    },
    {
      "seq": "72",
      "time": "2023-01-16T20:31:02.000Z",
      "content": "How do we participate in the “wisdom” of the world? https://bookofmormon.online/lehites/nephis-vision/19"
    },
    {
      "seq": "436",
      "time": "2023-01-17T03:22:27.000Z",
      "content": "Nephi’s rhetorical question in verse 6 suggests that these verses tell us what it means to fulfill all righteousness. How do they do so? Does this have something to do with other reasons for baptism besides the remission of sin? https://bookofmormon.online/nephis-testimony/4"
    },
    {
      "seq": "1144",
      "time": "2023-01-17T10:13:53.000Z",
      "content": "Is Alma still using the word faith to mean an act, something one can do? What do we learn about the seed if we don’t cast it out? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/17"
    },
    {
      "seq": "1089",
      "time": "2023-01-17T17:05:19.000Z",
      "content": "In what sense were the people of Ammon wiser than the Nephites? https://bookofmormon.online/reign-of-judges/korihor/7"
    },
    {
      "seq": "790",
      "time": "2023-01-17T23:56:45.000Z",
      "content": "In what senses would all have to perish if it weren’t for the redemption that Christ brings? https://bookofmormon.online/recolonization/abinadi/42"
    },
    {
      "seq": "1327",
      "time": "2023-01-18T06:48:10.000Z",
      "content": "What does it mean to say that the laws became corrupted? https://bookofmormon.online/gadianton/34"
    },
    {
      "seq": "1194",
      "time": "2023-01-18T13:39:36.000Z",
      "content": "Why does Alma have a vision of Lehi at this point? https://bookofmormon.online/zarahemla/77"
    },
    {
      "seq": "459",
      "time": "2023-01-18T20:31:02.000Z",
      "content": "What does it mean for a person to have a certain performance consecrated to him or her? What would it mean for that not to be the case? https://bookofmormon.online/nephis-testimony/14"
    },
    {
      "seq": "1759",
      "time": "2023-01-19T03:22:27.000Z",
      "content": "Have the things that the brother of Jared saw “gone forth”? Does that mean the Gentiles have repented and become clean? https://bookofmormon.online/moroni/42"
    },
    {
      "seq": "120",
      "time": "2023-01-19T10:13:53.000Z",
      "content": "Verse 15 says they had been killing animals with their slings; how does the breaking of Nephi’s bow change that? https://bookofmormon.online/lehites/116"
    },
    {
      "seq": "437",
      "time": "2023-01-19T17:05:19.000Z",
      "content": "Verse 8 begins with “Wherefore . . .”: because the events of verse 7 happened, the event of verse 8 happened. What does this teach us? Does it say anything about the gift of the Holy Ghost? https://bookofmormon.online/nephis-testimony/4"
    },
    {
      "seq": "1443",
      "time": "2023-01-19T23:56:45.000Z",
      "content": "What is the point of the comment of this verse? Why is it important to notice that the Lord is blessing the seed of Jacob and that of Joseph? https://bookofmormon.online/mormon/52"
    },
    {
      "seq": "1631",
      "time": "2023-01-20T06:48:10.000Z",
      "content": "Since the proud will be burned, it is a good idea to know who is included among them. In what ways might we be proud? https://bookofmormon.online/jesus/196"
    },
    {
      "seq": "1614",
      "time": "2023-01-20T13:39:36.000Z",
      "content": "These verses clearly are verses of rejoicing. Who is rejoicing and why? https://bookofmormon.online/jesus-teachings/41"
    },
    {
      "seq": "968",
      "time": "2023-01-20T20:31:02.000Z",
      "content": "For what sin does Amulek say Zeezrom will be destroyed? For tempting him? https://bookofmormon.online/reign-of-judges/ammonihah/64"
    },
    {
      "seq": "1452",
      "time": "2023-01-21T03:22:27.000Z",
      "content": "What is the connection between not returning railing for railing but suffering persecution and affliction, on the one hand, and being humble and penitent before God, on the other? https://bookofmormon.online/gadianton/167"
    },
    {
      "seq": "943",
      "time": "2023-01-21T10:13:53.000Z",
      "content": "What particular words of the fathers does Alma have in mind? Does the context answer that question? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/28"
    },
    {
      "seq": "1702",
      "time": "2023-01-21T17:05:19.000Z",
      "content": "How is Mormon’s message in these verses intended to help Moroni? (Does the story of depravity Mormon has just told serve a purpose in relation to these verses?) https://bookofmormon.online/downfall/108"
    },
    {
      "seq": "675",
      "time": "2023-01-21T23:56:45.000Z",
      "content": "Why would saying this about a beggar mean that we have no interest in the kingdom of God? https://bookofmormon.online/benjamin/77"
    },
    {
      "seq": "147",
      "time": "2023-01-22T06:48:10.000Z",
      "content": "Do these verses help us understand why Nephi is reading from Isaiah? https://bookofmormon.online/brass-plates/1"
    },
    {
      "seq": "669",
      "time": "2023-01-22T13:39:36.000Z",
      "content": "not allow the beggar to beg in vain (given the number of beggars in the world and the limitations of our resources, how do we do this?) https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1058",
      "time": "2023-01-22T20:31:02.000Z",
      "content": "What does this experience teach us about our own relations with others? https://bookofmormon.online/ammon/121"
    },
    {
      "seq": "1026",
      "time": "2023-01-23T03:22:27.000Z",
      "content": "What does Lamoni understand God to be? https://bookofmormon.online/ammon/25"
    },
    {
      "seq": "1140",
      "time": "2023-01-23T10:13:53.000Z",
      "content": "Literally speaking, what does it mean for the understanding to be enlightened? What enlightens it? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/16"
    },
    {
      "seq": "1644",
      "time": "2023-01-23T17:05:19.000Z",
      "content": "Notice the first element of the good news: Christ came into the world to do the will of his Father, and he did so because his Father sent him. How is that good news? https://bookofmormon.online/jesus/219"
    },
    {
      "seq": "360",
      "time": "2023-01-23T23:56:45.000Z",
      "content": "Do the names used here have particular significance? (Why, for example, speak of Christ as a child, as the verse does in the beginning, and then use the title of “Father”?) https://bookofmormon.online/isaiah/52"
    },
    {
      "seq": "340",
      "time": "2023-01-24T06:48:10.000Z",
      "content": "Does thinking in terms of types and shadows throw any light on this verse? https://bookofmormon.online/jacobs-sermon/42"
    },
    {
      "seq": "1693",
      "time": "2023-01-24T13:39:36.000Z",
      "content": "If these chapters were a movie, it would be “R” rated. Why does Mormon tell us of the carnage he witnessed? (In the next chapter, almost 220,000 people—men, women, and children—are killed in one battle.) https://bookofmormon.online/mormon/78"
    },
    {
      "seq": "1457",
      "time": "2023-01-24T20:31:02.000Z",
      "content": "When the Lord says that his fair ones have fallen because of their iniquity, is he saying they died because of it, or is he using the word fallen in some other sense? https://bookofmormon.online/jesus/13"
    },
    {
      "seq": "754",
      "time": "2023-01-25T03:22:27.000Z",
      "content": "Do you think this verse shows King Noah to be fearful? Why or why not? https://bookofmormon.online/recolonization/40"
    },
    {
      "seq": "16",
      "time": "2023-01-25T10:13:53.000Z",
      "content": "What does it mean to be “faithful in keeping the commandments of the Lord”? What does the word faithful or faithfully add that is important? Why not just say “keeping the commandments”? https://bookofmormon.online/lehites/30"
    },
    {
      "seq": "1211",
      "time": "2023-01-25T17:05:19.000Z",
      "content": "What does this verse suggest about our knowledge of the history of the descendants of Lehi? https://bookofmormon.online/reign-of-judges/zoramites/17"
    },
    {
      "seq": "1479",
      "time": "2023-01-25T23:56:45.000Z",
      "content": "Doesn’t Nephi already have power to baptize? If not, why not? https://bookofmormon.online/jesus/50"
    },
    {
      "seq": "1085",
      "time": "2023-01-26T06:48:10.000Z",
      "content": "Where do we find people teaching Korihor’s doctrine? Do we ever find it in church classes? https://bookofmormon.online/reign-of-judges/korihor/4"
    },
    {
      "seq": "1477",
      "time": "2023-01-26T13:39:36.000Z",
      "content": "What is the significance of this event? Compare it to Thomas’s experience in John 20:24–29. Is it possible to see this as, among other things, a symbol of their part in the crucifixion? https://bookofmormon.online/jesus/45"
    },
    {
      "seq": "1028",
      "time": "2023-01-26T20:31:02.000Z",
      "content": "For Lamoni, what is the most important proof that Ammon is the Great Spirit? https://bookofmormon.online/ammon/31"
    },
    {
      "seq": "1080",
      "time": "2023-01-27T03:22:27.000Z",
      "content": "What is Korihor’s argument for his claim that we cannot know that there will be a Christ? https://bookofmormon.online/reign-of-judges/korihor/3"
    },
    {
      "seq": "128",
      "time": "2023-01-27T10:13:53.000Z",
      "content": "Of what do Laman and Lemuel accuse Nephi? What evidence do they have for their accusation? https://bookofmormon.online/lehites/130"
    },
    {
      "seq": "1576",
      "time": "2023-01-27T17:05:19.000Z",
      "content": "Why do you think that Jesus ascends to heaven in a cloud, obscured from the view of the multitudes? https://bookofmormon.online/jesus/147"
    },
    {
      "seq": "232",
      "time": "2023-01-27T23:56:45.000Z",
      "content": "If Lehi is speaking to his sons and his daughters (verse 5; see also verse 3), on whom does he say the curse will be placed (verse 6)? https://bookofmormon.online/promised-land/lehi/73"
    },
    {
      "seq": "1508",
      "time": "2023-01-28T06:48:10.000Z",
      "content": "Can you think of particular adversaries that Jesus might have in mind in verses 25–26? How do these examples apply to us? https://bookofmormon.online/jesus/72"
    },
    {
      "seq": "671",
      "time": "2023-01-28T20:31:02.000Z",
      "content": "What does “master of sin” mean? When Benjamin equates being the master of sin with being the evil spirit spoken of by the fathers, an enemy to all righteousness, what does he teach us? https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1808",
      "time": "2023-01-29T03:22:27.000Z",
      "content": "What fruits show that one is worthy of baptism? https://bookofmormon.online/moroni/95"
    },
    {
      "seq": "730",
      "time": "2023-01-29T10:13:53.000Z",
      "content": "What’s the point of this tower? Why does the writer tell us about it? How does it contrast with Benjamin’s tower? https://bookofmormon.online/recolonization/26"
    },
    {
      "seq": "1763",
      "time": "2023-01-29T17:05:19.000Z",
      "content": "We hear that those who won’t listen to the Lord’s servants won’t listen to him. Here, however, that is reversed. Of course, those who won’t listen to the master won’t listen to the servants; what point is the Lord making here? https://bookofmormon.online/moroni/47"
    },
    {
      "seq": "1262",
      "time": "2023-01-29T23:56:45.000Z",
      "content": "What is the relation of this Moroni to the Moroni who finished the abridgment of the gold plates and buried them? Why might Mormon have named his son Moroni? https://bookofmormon.online/war/6"
    },
    {
      "seq": "529",
      "time": "2023-01-30T06:48:10.000Z",
      "content": "What is Jacob’s point here? What possible objection is he replying to? https://bookofmormon.online/land-of-nephi/24"
    },
    {
      "seq": "1246",
      "time": "2023-01-30T13:39:36.000Z",
      "content": "Verse 8 says “it was not expedient that man should be reclaimed from this temporal death.” Then verse 9 says “it was expedient that mankind should be reclaimed from this spiritual death.” Can you explain why each is true? https://bookofmormon.online/reign-of-judges/corianton/31"
    },
    {
      "seq": "1793",
      "time": "2023-01-30T20:31:02.000Z",
      "content": "What does it mean to say that Jesus laid down his life so he could take it up again? https://bookofmormon.online/moroni/77"
    },
    {
      "seq": "779",
      "time": "2023-01-31T03:22:27.000Z",
      "content": "Another translation of the beginning of this verse in Isaiah is “By his suffering he shall see joy.” Why is that teaching important to us? https://bookofmormon.online/recolonization/abinadi/29"
    },
    {
      "seq": "590",
      "time": "2023-01-31T10:13:53.000Z",
      "content": "These sayings and records are true. Is this claim a rejoinder to the Lamanite claims about the records? https://bookofmormon.online/zarahemla/19"
    },
    {
      "seq": "897",
      "time": "2023-01-31T17:05:19.000Z",
      "content": "What does the last part of verse 14 mean: “[the law] has been acknowledged by this people; therefore this people must abide by the law”? How do we acknowledge our laws? https://bookofmormon.online/reign-of-judges/6"
    },
    {
      "seq": "858",
      "time": "2023-01-31T23:56:45.000Z",
      "content": "What does it mean to be racked? https://bookofmormon.online/zarahemla/78"
    },
    {
      "seq": "927",
      "time": "2023-02-01T06:48:10.000Z",
      "content": "Alma seems to use murder as the type of all sin. Why is it appropriate to do so? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/13"
    },
    {
      "seq": "912",
      "time": "2023-02-01T13:39:36.000Z",
      "content": "In this sermon Alma asks forty-five questions. Why do you think he uses questions to structure what he says? https://bookofmormon.online/reign-of-judges/50"
    },
    {
      "seq": "1283",
      "time": "2023-02-01T20:31:02.000Z",
      "content": "Moroni’s letter is strong. Do you think he knew Pahoran personally? What in the letter would serve as evidence for your answer? https://bookofmormon.online/war/east/63"
    },
    {
      "seq": "1336",
      "time": "2023-02-02T03:22:27.000Z",
      "content": "What does it mean to say that the kingdom of God is at hand? Does it refer only to Christ’s first or second comings? Could it have more than one meaning? https://bookofmormon.online/gadianton/56"
    },
    {
      "seq": "548",
      "time": "2023-02-02T10:13:53.000Z",
      "content": "With the worst branches gradually removed and the growth of the tops kept in line with the root system, the trees begin to produce good fruit again, each of them equal to the other. https://bookofmormon.online/olive-tree/42"
    },
    {
      "seq": "1817",
      "time": "2023-02-02T17:05:19.000Z",
      "content": "How might the meetings of the Nephite Saints have been different from ours? How similar? https://bookofmormon.online/moroni/97"
    },
    {
      "seq": "719",
      "time": "2023-02-02T23:56:45.000Z",
      "content": "Isn’t the experience they had, the changing of their hearts, a permanent experience? (How long did its results last?) https://bookofmormon.online/zarahemla/34"
    },
    {
      "seq": "1175",
      "time": "2023-02-03T06:48:10.000Z",
      "content": "How would you characterize each group? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/33"
    },
    {
      "seq": "355",
      "time": "2023-02-03T13:39:36.000Z",
      "content": "One way to understand this light literally is as the light from the destruction by fire of the Assyrians. On the other hand, the symbolism of light is fairly obvious. What might the relation be between the literal and the symbolic meanings? https://bookofmormon.online/isaiah/51"
    },
    {
      "seq": "1770",
      "time": "2023-02-03T20:31:02.000Z",
      "content": "What are “the greater things” that those who come to Jesus will be shown? https://bookofmormon.online/moroni/50"
    },
    {
      "seq": "1328",
      "time": "2023-02-04T03:22:27.000Z",
      "content": "“They who chose evil were more numerous than they who chose good” and “the laws had become corrupted” are both given as causes of “their ripening for destruction.” How are these things related? https://bookofmormon.online/gadianton/34"
    },
    {
      "seq": "509",
      "time": "2023-02-04T10:13:53.000Z",
      "content": "What does it mean to have our minds firm? https://bookofmormon.online/jacobs-address/14"
    },
    {
      "seq": "1345",
      "time": "2023-02-04T17:05:19.000Z",
      "content": "Why is the comparison of the Gadianton robbers to Cain an important one for us? What does it tell us? https://bookofmormon.online/gadianton/83"
    },
    {
      "seq": "39",
      "time": "2023-02-04T23:56:45.000Z",
      "content": "Why is beauty a representation of good and godliness? Is there a connection between truth, goodness, and beauty? https://bookofmormon.online/lehites/nephis-vision/5"
    },
    {
      "seq": "1741",
      "time": "2023-02-05T06:48:10.000Z",
      "content": "How can we ask not to yield to temptation? Can the Lord prevent us from falling prey to temptation? https://bookofmormon.online/moroni/29"
    },
    {
      "seq": "86",
      "time": "2023-02-05T13:39:36.000Z",
      "content": "Why does the angel focus so much on the covenants of the Bible? https://bookofmormon.online/lehites/nephis-vision/38"
    },
    {
      "seq": "1749",
      "time": "2023-02-05T20:31:02.000Z",
      "content": "The writer (whether Mormon or Ether) calls the brother of Jared’s sin of omission—neglecting to pray—an evil. Is he exaggerating for emphasis, or is neglecting to pray an evil thing? https://bookofmormon.online/jaredites/14"
    },
    {
      "seq": "1223",
      "time": "2023-02-06T03:22:27.000Z",
      "content": "How is the phrase “lusts of the eyes” significant? (Compare Isaiah 3:16; 2 Peter 2:14; 1 John 2:16; 1 Nephi 16:38; and D&C 56:17; 68:31.) Does this suggest anything about the sin that Alma refers to in verse 3? https://bookofmormon.online/reign-of-judges/corianton/4"
    },
    {
      "seq": "708",
      "time": "2023-02-06T10:13:53.000Z",
      "content": "Why is the Lord compared to a master here? Why must we serve him? What does that say about the necessity of obedience? In other words, does this explain why obedience is a requirement of salvation? https://bookofmormon.online/benjamin/99"
    },
    {
      "seq": "279",
      "time": "2023-02-06T17:05:19.000Z",
      "content": "Isaiah mentions that Abraham was called “alone”—in other words, when he was the only one in Israel—and that he was blessed. Presumably the blessing referred to is that of numerous posterity. How is it relevant that he was alone? https://bookofmormon.online/jacobs-sermon/12"
    },
    {
      "seq": "1618",
      "time": "2023-02-06T23:56:45.000Z",
      "content": "What is the point of this promise? Why would we want pavement of fair colors, foundations of sapphires, and so on? https://bookofmormon.online/jesus-teachings/45"
    },
    {
      "seq": "1446",
      "time": "2023-02-07T06:48:10.000Z",
      "content": "What covenant has the Lord made with the house of Jacob? Why does the house of Jacob have to know about that covenant? https://bookofmormon.online/mormon/53"
    },
    {
      "seq": "562",
      "time": "2023-02-07T13:39:36.000Z",
      "content": "What does Enos mean when he says his soul hungered? What caused his soul to hunger? For what did it hunger? https://bookofmormon.online/land-of-nephi/30"
    },
    {
      "seq": "759",
      "time": "2023-02-07T20:31:02.000Z",
      "content": "If a stiff-necked people require a strict law, what would a humble, celestial people require? https://bookofmormon.online/recolonization/abinadi/16"
    },
    {
      "seq": "625",
      "time": "2023-02-08T03:22:27.000Z",
      "content": "What is the significance of this list of the things Christ suffered? What does it tell us? https://bookofmormon.online/benjamin/40"
    },
    {
      "seq": "575",
      "time": "2023-02-08T10:13:53.000Z",
      "content": "Notice that Enos is quite concerned (as are Jarom and Omni after him) that the records be preserved. Why? Why is it important that their concern be recorded in the Book of Mormon? What does it mean to us? https://bookofmormon.online/land-of-nephi/34"
    },
    {
      "seq": "500",
      "time": "2023-02-08T17:05:19.000Z",
      "content": "How do these verses apply to us? https://bookofmormon.online/jacobs-address/10"
    },
    {
      "seq": "376",
      "time": "2023-02-08T23:56:45.000Z",
      "content": "What reason does Nephi give for the writings of Isaiah being of value in the last days? Why does Nephi address particularly those who don’t value Isaiah’s work? https://bookofmormon.online/nephis-teachings/4"
    },
    {
      "seq": "1509",
      "time": "2023-02-09T06:48:10.000Z",
      "content": "In Galilee, these verses were directed at the Pharisees and their insistence on the formalities of the Mosaic law. To whom do you think the verses would apply among the Nephites? https://bookofmormon.online/jesus/73"
    },
    {
      "seq": "513",
      "time": "2023-02-09T13:39:36.000Z",
      "content": "Does this verse tell us that a white skin indicates righteousness? How do we make sense of this verse without inferring that Jacob condones racism? https://bookofmormon.online/promised-land/56"
    },
    {
      "seq": "796",
      "time": "2023-02-09T20:31:02.000Z",
      "content": "Why is the message of the resurrection such an important part of Abinadi’s message to Noah’s people? https://bookofmormon.online/recolonization/abinadi/50"
    },
    {
      "seq": "543",
      "time": "2023-02-10T03:22:27.000Z",
      "content": "The servant suggests that the trees have gone bad because the tops have been allowed to “overcome” the roots. https://bookofmormon.online/olive-tree/31"
    },
    {
      "seq": "342",
      "time": "2023-02-10T10:13:53.000Z",
      "content": "What does Jacob mean when he says the promises that have been made are promises according to the flesh? https://bookofmormon.online/jacobs-sermon/44"
    },
    {
      "seq": "1498",
      "time": "2023-02-10T17:05:19.000Z",
      "content": "What does mercy mean? What does it take to be merciful? How are the requirement to be righteous (verse 6) and the requirement to be merciful related to each other? https://bookofmormon.online/jesus/66"
    },
    {
      "seq": "1381",
      "time": "2023-02-10T23:56:45.000Z",
      "content": "If Lehi wasn’t a whit behind Nephi in righteousness, can we assume that he too had the sealing power? If not, why not? In either case, why don’t we hear more about Lehi? https://bookofmormon.online/nephi/70"
    },
    {
      "seq": "1248",
      "time": "2023-02-11T06:48:10.000Z",
      "content": "How does Alma’s teaching about restoration in the previous chapter fit with this teaching? https://bookofmormon.online/reign-of-judges/corianton/32"
    },
    {
      "seq": "398",
      "time": "2023-02-11T13:39:36.000Z",
      "content": "What is a secret combination? (See 2 Nephi 9:9 and the corresponding study questions.) What is the point of the flaxen cord? What does the fact that it is flaxen—made of flax (linen) or looking like flax—indicate? https://bookofmormon.online/nephis-teachings/22"
    },
    {
      "seq": "149",
      "time": "2023-02-11T20:31:02.000Z",
      "content": "What does he mean by “my name” in this verse? Is it parallel to “my praise”? If so, what is the point here, and how are we to understand that point? Does verse 11 answer those questions? https://bookofmormon.online/brass-plates/3"
    },
    {
      "seq": "676",
      "time": "2023-02-12T03:22:27.000Z",
      "content": "Is the answer to the question about verse 18 that if we say that about a beggar, we say it about ourselves and we condemn ourselves in saying it? https://bookofmormon.online/benjamin/78"
    },
    {
      "seq": "477",
      "time": "2023-02-12T10:13:53.000Z",
      "content": "How do you imagine that Nephi “labored all his days for their welfare”? https://bookofmormon.online/land-of-nephi/11"
    },
    {
      "seq": "225",
      "time": "2023-02-12T17:05:19.000Z",
      "content": "Lehi says that the writings of Judah and those of his descendants “shall grow together.” What does that metaphor mean? What does it tell us about the relation of the Bible and the Book of Mormon? https://bookofmormon.online/promised-land/lehi/53"
    },
    {
      "seq": "633",
      "time": "2023-02-12T23:56:45.000Z",
      "content": "Why does Benjamin introduce the discussion of little children here? https://bookofmormon.online/benjamin/48"
    },
    {
      "seq": "1654",
      "time": "2023-02-13T06:48:10.000Z",
      "content": "Christ gives the purpose of his commandment: “that ye may be sanctified.” Does the word sanctified here have the same meaning that it has in our contemporary doctrinal discussions? How would you justify your answer? https://bookofmormon.online/jesus/221"
    },
    {
      "seq": "1814",
      "time": "2023-02-13T13:39:36.000Z",
      "content": "How do we nourish members “by the good word of God”? How do we keep each other “in the right way”? https://bookofmormon.online/moroni/96"
    },
    {
      "seq": "1725",
      "time": "2023-02-13T20:31:02.000Z",
      "content": "To what does “that which will canker” refer? How would that thing canker its possessors? https://bookofmormon.online/moroni/17"
    },
    {
      "seq": "1064",
      "time": "2023-02-14T03:22:27.000Z",
      "content": "Why does Ammon call what he has been doing both boasting (verse 12) and rejoicing (verses 11 and 16)? https://bookofmormon.online/ammon/139"
    },
    {
      "seq": "267",
      "time": "2023-02-14T10:13:53.000Z",
      "content": "What might the image of feeding on one’s own flesh mean (verse 18)? It has an obvious literal meaning, but is there any other meaning as well? https://bookofmormon.online/jacobs-sermon/8"
    },
    {
      "seq": "1069",
      "time": "2023-02-14T17:05:19.000Z",
      "content": "Why is his desire sinful? Is sinful too strong a word, or does Alma really mean what that word connotes? If Alma isn’t using hyperbole when he calls his desire sinful, what in our own experience might be comparable? https://bookofmormon.online/reign-of-judges/87"
    },
    {
      "seq": "1016",
      "time": "2023-02-14T23:56:45.000Z",
      "content": "What does it mean that the glad tidings of the Lord are made known to us in “plain terms”? We’ve seen a number of relatively difficult passages in the Book of Mormon, including some in this chapter. https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1730",
      "time": "2023-02-15T06:48:10.000Z",
      "content": "Why is it that those who believe in a varying god don’t believe in a God of miracles? https://bookofmormon.online/moroni/22"
    },
    {
      "seq": "372",
      "time": "2023-02-15T13:39:36.000Z",
      "content": "What would it take to have the spirit of prophecy? Is that limited to particular persons or callings, or is it a gift anyone may have? https://bookofmormon.online/nephis-teachings/2"
    },
    {
      "seq": "1703",
      "time": "2023-02-15T20:31:02.000Z",
      "content": "Notice that Mormon speaks of “the remnant of this people.” To whom does this refer? To whom was he speaking in chapter 6? We call the remnant “Lamanites,” but Mormon seems not to be thinking of them in that way. https://bookofmormon.online/mormon/90"
    },
    {
      "seq": "1342",
      "time": "2023-02-16T03:22:27.000Z",
      "content": "How does the attitude of the members of the church compare here with Moroni’s attitude? https://bookofmormon.online/gadianton/71"
    },
    {
      "seq": "1690",
      "time": "2023-02-16T10:13:53.000Z",
      "content": "What is an “idle witness”? https://bookofmormon.online/downfall/89"
    },
    {
      "seq": "1207",
      "time": "2023-02-16T17:05:19.000Z",
      "content": "These verses are beautiful and often quoted. Why does Alma seem to equate wisdom with learning to keep the commandments (verse 35)? https://bookofmormon.online/reign-of-judges/helaman/24"
    },
    {
      "seq": "405",
      "time": "2023-02-16T23:56:45.000Z",
      "content": "Why is it that without charity we are nothing? What is the difference between this nothing and the nothing that Benjamin says we must recognize ourselves to be if we are to receive salvation ( Mosiah 4:11)? https://bookofmormon.online/nephis-teachings/25"
    },
    {
      "seq": "1304",
      "time": "2023-02-17T06:48:10.000Z",
      "content": "What little thing do we see here that will bring down the Nephites? Why do pride and contention go together? (Compare Helaman 3:33–34.) https://bookofmormon.online/gadianton/9"
    },
    {
      "seq": "91",
      "time": "2023-02-17T13:39:36.000Z",
      "content": "What does it mean to say that the gospel is plain? Does the word mean “simple” or “unadorned”? Does it mean “clear and obvious”? https://bookofmormon.online/lehites/nephis-vision/42"
    },
    {
      "seq": "1235",
      "time": "2023-02-17T20:31:02.000Z",
      "content": "Are we as scrupulous in distinguishing our opinions from the truth as Alma was? https://bookofmormon.online/reign-of-judges/corianton/15"
    },
    {
      "seq": "672",
      "time": "2023-02-18T03:22:27.000Z",
      "content": "What does it mean to be an enemy to all righteousness? How is that possible? https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1234",
      "time": "2023-02-18T10:13:53.000Z",
      "content": "Alma gives his opinion that the righteous will be bodily resurrected at the time of Christ’s resurrection. First, why does he mention it as his opinion? Was he right? https://bookofmormon.online/reign-of-judges/corianton/15"
    },
    {
      "seq": "1628",
      "time": "2023-02-18T17:05:19.000Z",
      "content": "What complaint does this prophecy depict the people making? Do we make that complaint? How? https://bookofmormon.online/jesus/193"
    },
    {
      "seq": "215",
      "time": "2023-02-18T23:56:45.000Z",
      "content": "Why is the devil miserable? Does the answer to that say anything about verse 25? https://bookofmormon.online/promised-land/lehi/38"
    },
    {
      "seq": "823",
      "time": "2023-02-19T06:48:10.000Z",
      "content": "(See also Mosiah 26:8.) How can a king decide who has authority over the church? What does your answer to that question tell us about Mosiah and Alma’s society? https://bookofmormon.online/zarahemla/49"
    },
    {
      "seq": "655",
      "time": "2023-02-19T13:39:36.000Z",
      "content": "Notice that he equates “coming to a knowledge of God’s glory” with “knowing his goodness, tasting his love, and receiving a remission of sins.” How are those the same things? (The word glory means “praise” or “praiseworthiness.”) https://bookofmormon.online/benjamin/70"
    },
    {
      "seq": "75",
      "time": "2023-02-19T20:31:02.000Z",
      "content": "All three of these verses speak of those who fight against the apostles. What fight are they speaking of? Why is it a fight against the apostles rather than against God? https://bookofmormon.online/lehites/nephis-vision/19"
    },
    {
      "seq": "60",
      "time": "2023-02-20T03:22:27.000Z",
      "content": "How do the fountain of living waters and the tree of life both symbolize the love of God? https://bookofmormon.online/lehites/nephis-vision/13"
    },
    {
      "seq": "1714",
      "time": "2023-02-20T10:13:53.000Z",
      "content": "Why does Moroni tell them to search the writings of Isaiah? How are they relevant to this context? https://bookofmormon.online/moroni/8"
    },
    {
      "seq": "946",
      "time": "2023-02-20T17:05:19.000Z",
      "content": "What is the result of Alma’s sermon? (See Alma 6:1–4.) https://bookofmormon.online/reign-of-judges/zarahemla-sermon/36"
    },
    {
      "seq": "150",
      "time": "2023-02-20T23:56:45.000Z",
      "content": "In verse 4, the Lord described Israel as obstinate. Here he says they have been refined and were chosen in affliction. How do those go together? https://bookofmormon.online/brass-plates/3"
    },
    {
      "seq": "266",
      "time": "2023-02-21T06:48:10.000Z",
      "content": "The usual answer to the question of verse 16 would be no, but in reference to the children of God, as verse 17 shows, the answer is yes. What is the point of verses 16–17? https://bookofmormon.online/jacobs-sermon/8"
    },
    {
      "seq": "1106",
      "time": "2023-02-21T13:39:36.000Z",
      "content": "What might the phrase “our God” suggest? Is the man skeptical that his God is also Alma’s, or is he appealing to what he and Alma have in common? https://bookofmormon.online/reign-of-judges/zoramites/19"
    },
    {
      "seq": "1735",
      "time": "2023-02-21T20:31:02.000Z",
      "content": "What does it mean to be damned? https://bookofmormon.online/moroni/26"
    },
    {
      "seq": "1372",
      "time": "2023-02-22T03:22:27.000Z",
      "content": "Against what does he warn us? Can you be specific about that warning? In other words, in what specific ways might we be uncircumcised, blind, or stiff-necked? https://bookofmormon.online/nephi/42"
    },
    {
      "seq": "145",
      "time": "2023-02-22T10:13:53.000Z",
      "content": "Compare this verse to 1 Nephi 1:20 and 6:4. Nephi describes his purposes in writing in three different ways. How are those ways related to each other? https://bookofmormon.online/promised-land/13"
    },
    {
      "seq": "14",
      "time": "2023-02-22T17:05:19.000Z",
      "content": "Verse 8 tells us that Lehi knew that Nephi had been blessed. The suggestion is that he knew because of what Nephi said in verse 7. How is Nephi’s statement in verse 7 evidence of having been blessed? https://bookofmormon.online/lehites/23"
    },
    {
      "seq": "1303",
      "time": "2023-02-22T23:56:45.000Z",
      "content": "When do we see people (including ourselves?) practicing priestcraft? https://bookofmormon.online/gadianton/2"
    },
    {
      "seq": "564",
      "time": "2023-02-23T06:48:10.000Z",
      "content": "Enos says here that his guilt was swept away, but he didn’t mention guilt before. Instead he talked about remembering what he had heard about eternal life and the joy of the saints. Why does guilt come up here? https://bookofmormon.online/land-of-nephi/31"
    },
    {
      "seq": "1066",
      "time": "2023-02-23T13:39:36.000Z",
      "content": "What mysteries does Ammon have in mind? Has he been speaking of them in the previous verses, such as verse 17? https://bookofmormon.online/ammon/147"
    },
    {
      "seq": "69",
      "time": "2023-02-23T20:31:02.000Z",
      "content": "Why does Nephi see a vision of the crucifixion of Jesus, but not of his resurrection? https://bookofmormon.online/lehites/nephis-vision/18"
    },
    {
      "seq": "1258",
      "time": "2023-02-24T03:22:27.000Z",
      "content": "What is the difference between the motivation of the Lamanites, Amalekites, and Zoramites, on the one hand, and the Nephites, on the other? https://bookofmormon.online/war/3"
    },
    {
      "seq": "1469",
      "time": "2023-02-24T10:13:53.000Z",
      "content": "Who is speaking here? https://bookofmormon.online/mormon/55"
    },
    {
      "seq": "1810",
      "time": "2023-02-24T17:05:19.000Z",
      "content": "Are taking the name of Christ upon oneself and having a determination to serve him to the end the same thing or two different things? What does it mean, literally, to take Christ’s name upon oneself? https://bookofmormon.online/moroni/95"
    },
    {
      "seq": "942",
      "time": "2023-02-24T23:56:45.000Z",
      "content": "How does Alma’s testimony that he has fasted and prayed many days to know these things square with the story of conversion, in which he seems to have gained a testimony quickly and without fasting and prayer? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/27"
    },
    {
      "seq": "1543",
      "time": "2023-02-25T06:48:10.000Z",
      "content": "Remember that the word strait means “narrow”: the gate leading to destruction is wide and the road to destruction is spacious, but the gate leading to life—eternal life—is narrow. What does it mean to say that few find the strait gate? https://bookofmormon.online/jesus/96"
    },
    {
      "seq": "1014",
      "time": "2023-02-25T13:39:36.000Z",
      "content": "What is the day of salvation? When is it? In what sense or senses is it drawing nigh? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1694",
      "time": "2023-02-25T20:31:02.000Z",
      "content": "What does Mormon mean when he says “it is known of God that wickedness will not bring them forth unto them”? https://bookofmormon.online/mormon/82"
    },
    {
      "seq": "1590",
      "time": "2023-02-26T03:22:27.000Z",
      "content": "What miracles could Jesus show those on the American continents that he couldn’t show the Israelites? https://bookofmormon.online/jesus/167"
    },
    {
      "seq": "112",
      "time": "2023-02-26T10:13:53.000Z",
      "content": "What does this verse promise? https://bookofmormon.online/lehites/nephis-vision/54"
    },
    {
      "seq": "1282",
      "time": "2023-02-26T17:05:19.000Z",
      "content": "How did Nephite armies differ from today’s armies? Do our soldiers have any say as to who their officers are? What might this tell us about the Nephites? https://bookofmormon.online/war/west/3"
    },
    {
      "seq": "1302",
      "time": "2023-02-26T23:56:45.000Z",
      "content": "When do we see people practicing the kind of robbery that the Gadiantons did? https://bookofmormon.online/gadianton/2"
    },
    {
      "seq": "220",
      "time": "2023-02-27T06:48:10.000Z",
      "content": "Lehi says that the will of the flesh has evil in it. What is that will? (Compare Mosiah 3:16, 19.) How does the will of the flesh give the devil power to take us captive? https://bookofmormon.online/promised-land/lehi/40"
    },
    {
      "seq": "246",
      "time": "2023-02-27T13:39:36.000Z",
      "content": "Since obedience seems to be what I do rather than what the Lord does for me, what does it mean to pray to be obedient? https://bookofmormon.online/promised-land/50"
    },
    {
      "seq": "1288",
      "time": "2023-02-27T20:31:02.000Z",
      "content": "What kind of person is Pahoran? What does it take for us to learn to respond to criticism as he has, particularly when the criticism isn’t justified? https://bookofmormon.online/war/125"
    },
    {
      "seq": "962",
      "time": "2023-02-28T03:22:27.000Z",
      "content": "Does this fit with the pattern of preaching we have seen Alma use? (See the questions for Alma 8:9–11.) https://bookofmormon.online/reign-of-judges/ammonihah/37"
    },
    {
      "seq": "1015",
      "time": "2023-02-28T10:13:53.000Z",
      "content": "What does it mean that the day of salvation was being declared to all nations by angels when Alma was speaking? How is the announcement of the day of salvation something to be greeted with joy rather than fear? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1013",
      "time": "2023-02-28T17:05:19.000Z",
      "content": "Consider the message that follows in light of Alma’s warning against wresting the scriptures. https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "993",
      "time": "2023-02-28T23:56:45.000Z",
      "content": "In this lesson I will concentrate on chapter 13. •Alma 13 https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "1116",
      "time": "2023-03-01T06:48:10.000Z",
      "content": "We use the word faith in a few senses: sometimes to mean “fidelity” but most often to mean “trust” or “belief in the face of uncertainty.” Alma seems here to ignore the fact that the word can have multiple senses. Why might he do that? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/7"
    },
    {
      "seq": "244",
      "time": "2023-03-01T13:39:36.000Z",
      "content": "When did Nephi’s soul “droop in sin”? What was that sin? https://bookofmormon.online/promised-land/48"
    },
    {
      "seq": "1792",
      "time": "2023-03-01T20:31:02.000Z",
      "content": "Moroni illustrates the meaning of charity. He uses humans to illustrate faith, and he uses our relation to the Son to illustrate hope. How is this illustration of charity particularly significant? https://bookofmormon.online/moroni/77"
    },
    {
      "seq": "324",
      "time": "2023-03-02T03:22:27.000Z",
      "content": "Together, verses 29–30 seem to connect learning with riches. Why might they do so? What is the connection? Given the small population to whom Jacob is speaking, all of them family, who could be either wise or rich? https://bookofmormon.online/jacobs-sermon/34"
    },
    {
      "seq": "404",
      "time": "2023-03-02T10:13:53.000Z",
      "content": "Instead of priestcraft, the Lord has commanded people to have charity. Why is charity the antidote (or is it the response?) to priestcraft? https://bookofmormon.online/nephis-teachings/25"
    },
    {
      "seq": "1082",
      "time": "2023-03-02T17:05:19.000Z",
      "content": "What is the implication of describing prophecies as “foolish traditions of your fathers”? https://bookofmormon.online/reign-of-judges/korihor/3"
    },
    {
      "seq": "1638",
      "time": "2023-03-02T23:56:45.000Z",
      "content": "What does it mean to have all things common? Can we live this principle now? If so, how? If not, what can we do instead? https://bookofmormon.online/jesus/210"
    },
    {
      "seq": "1156",
      "time": "2023-03-03T06:48:10.000Z",
      "content": "Verse 36 said that we need to continue to exercise faith. Is that how we nourish the tree? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/24"
    },
    {
      "seq": "110",
      "time": "2023-03-03T13:39:36.000Z",
      "content": "Why was it important for Nephi to have the same vision as John? Why is it important for us to know that he did? https://bookofmormon.online/lehites/nephis-vision/53"
    },
    {
      "seq": "1331",
      "time": "2023-03-03T20:31:02.000Z",
      "content": "What does it mean that repentance “bringeth unto the power of the Redeemer”? Can you explain the literal meaning of that phrase? https://bookofmormon.online/gadianton/43"
    },
    {
      "seq": "45",
      "time": "2023-03-04T03:22:27.000Z",
      "content": "How does the vision that follows correlate with Lehi’s vision, and if what follows is an interpretation of the beautiful tree, what does that tell us about Lehi’s vision? https://bookofmormon.online/lehites/nephis-vision/6"
    },
    {
      "seq": "1573",
      "time": "2023-03-04T10:13:53.000Z",
      "content": "In this verse, to what does the phrase “these sayings” refer? Do sayings go beyond the commandments, or is saying just another word for commandment? Why might Christ have used the word saying here? https://bookofmormon.online/jesus/144"
    },
    {
      "seq": "1785",
      "time": "2023-03-04T17:05:19.000Z",
      "content": "What kinds of weaknesses is the Lord speaking of? Should we be grateful for our weaknesses? https://bookofmormon.online/moroni/76"
    },
    {
      "seq": "466",
      "time": "2023-03-04T23:56:45.000Z",
      "content": "Of whom is Nephi speaking in this verse? In other words, to whom does “many of us, if not all” refer? https://bookofmormon.online/nephis-testimony/19"
    },
    {
      "seq": "322",
      "time": "2023-03-05T06:48:10.000Z",
      "content": "What kind of “wisdom” does Jacob warn against? What makes that supposed wisdom foolishness? https://bookofmormon.online/jacobs-sermon/33"
    },
    {
      "seq": "958",
      "time": "2023-03-05T13:39:36.000Z",
      "content": "Were a modern prophet delivering a sermon like this, to what might he refer to remind us of what the Lord has done? https://bookofmormon.online/reign-of-judges/ammonihah/18"
    },
    {
      "seq": "697",
      "time": "2023-03-05T20:31:02.000Z",
      "content": "Why does Benjamin call Christ a “head”? https://bookofmormon.online/benjamin/94"
    },
    {
      "seq": "868",
      "time": "2023-03-06T03:22:27.000Z",
      "content": "Why do you think Alma describes what he had done as murder? (Compare Alma 5:23 and Matthew 10:28. What does it mean to destroy both soul, i.e., spirit, and body in hell?) https://bookofmormon.online/zarahemla/74"
    },
    {
      "seq": "1081",
      "time": "2023-03-06T10:13:53.000Z",
      "content": "Why do you think the Book of Mormon uses the word Christ (derived from Greek) rather than the word Messiah (derived from Hebrew) when they both mean the same thing and the Nephite language was originally Hebrew? https://bookofmormon.online/reign-of-judges/korihor/3"
    },
    {
      "seq": "428",
      "time": "2023-03-06T17:05:19.000Z",
      "content": "Why is what Nephi and Jacob have written sufficient? Sufficient for what? https://bookofmormon.online/nephis-testimony/2"
    },
    {
      "seq": "1609",
      "time": "2023-03-06T23:56:45.000Z",
      "content": "What is priestcraft? Where do we find it among us today? Do we see it outside of religion as well as within? Where? https://bookofmormon.online/jesus-teachings/34"
    },
    {
      "seq": "511",
      "time": "2023-03-07T06:48:10.000Z",
      "content": "Why are the Lamanites better off than the Nephites? https://bookofmormon.online/promised-land/56"
    },
    {
      "seq": "108",
      "time": "2023-03-07T13:39:36.000Z",
      "content": "How does this passage explain the wars of the time period that Nephi sees in vision? https://bookofmormon.online/lehites/nephis-vision/51"
    },
    {
      "seq": "23",
      "time": "2023-03-07T20:31:02.000Z",
      "content": "In both of these verses, Nephi asks how Laman and Lemuel could have forgotten. Does 1 Nephi 2:16 suggest an answer? https://bookofmormon.online/lehites/71"
    },
    {
      "seq": "733",
      "time": "2023-03-08T03:22:27.000Z",
      "content": "What Old Testament prophets might Abinadi compare to? Hosea? Amos? Others? What are the circumstances in which those prophets appear, and how are they like these circumstances? https://bookofmormon.online/recolonization/30"
    },
    {
      "seq": "1377",
      "time": "2023-03-08T10:13:53.000Z",
      "content": "We usually think of the sealing power in connection with such things as eternal marriage. Here we see that it goes beyond that. Can you explain how and what that might mean to us? https://bookofmormon.online/nephi/57"
    },
    {
      "seq": "1653",
      "time": "2023-03-08T17:05:19.000Z",
      "content": "Notice that the commandment has three parts: “repent . . . and come to me and be baptized.” Of what are we to repent? How do we go to him? https://bookofmormon.online/jesus/221"
    },
    {
      "seq": "277",
      "time": "2023-03-08T23:56:45.000Z",
      "content": "Does this passage explain the pit and the hole of verse 1? How? https://bookofmormon.online/jacobs-sermon/12"
    },
    {
      "seq": "1417",
      "time": "2023-03-09T06:48:10.000Z",
      "content": "Does this mean that those who believe after having seen the sign will be saved? If so, isn’t that unfair to those who haven’t seen such signs? https://bookofmormon.online/samuel/30"
    },
    {
      "seq": "370",
      "time": "2023-03-09T13:39:36.000Z",
      "content": "What does Nephi think is the point of these chapters from Isaiah? Does that differ from our usual way of understanding these chapters? If so, how? https://bookofmormon.online/nephis-teachings/1"
    },
    {
      "seq": "380",
      "time": "2023-03-09T20:31:02.000Z",
      "content": "What are the two purposes for Nephi’s writing? https://bookofmormon.online/nephis-teachings/11"
    },
    {
      "seq": "455",
      "time": "2023-03-10T03:22:27.000Z",
      "content": "Is Nephi speaking of his own people here or of his family, including the group with Laman and Lemuel, or of humanity in general? https://bookofmormon.online/nephis-testimony/13"
    },
    {
      "seq": "881",
      "time": "2023-03-10T10:13:53.000Z",
      "content": "Does this verse tell us that the judges were elected democratically, or does it mean something else? What evidence can you give for your conclusion? https://bookofmormon.online/zarahemla/99"
    },
    {
      "seq": "321",
      "time": "2023-03-10T17:05:19.000Z",
      "content": "What part of Isaiah’s prophecy do these verses refer to and amplify? https://bookofmormon.online/jacobs-sermon/33"
    },
    {
      "seq": "205",
      "time": "2023-03-10T23:56:45.000Z",
      "content": "What does it mean that all are lost because of Adam and Eve’s transgression? How does that square with the second article of faith? https://bookofmormon.online/promised-land/lehi/35"
    },
    {
      "seq": "1148",
      "time": "2023-03-11T06:48:10.000Z",
      "content": "Alma uses parallelism here: “Your understanding doth begin to be enlightened, and your mind doth begin to expand.” How might the first half of this parallel help us understand what it means for our minds to expand? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/21"
    },
    {
      "seq": "583",
      "time": "2023-03-11T13:39:36.000Z",
      "content": "Is “partake of his salvation, and the power of his redemption” parallel to “offer your whole souls as an offering unto him, and continue in fasting and praying, and endure to the end”? https://bookofmormon.online/land-of-nephi/42"
    },
    {
      "seq": "523",
      "time": "2023-03-11T20:31:02.000Z",
      "content": "This seems to be a short psalm of praise. What is its point, and how does it fit in with the discussion that came before? How does it lead into the following discussion? https://bookofmormon.online/land-of-nephi/21"
    },
    {
      "seq": "534",
      "time": "2023-03-12T03:22:27.000Z",
      "content": "The master says he will take the new shoots and graft them in somewhere else. What matters most is that the root of the old tree is preserved. https://bookofmormon.online/olive-tree/5"
    },
    {
      "seq": "1662",
      "time": "2023-03-12T10:13:53.000Z",
      "content": "How does the book of Mormon serve as a warning to us? How does it serve as a warning to the Gentiles? (Who are the Gentiles?) https://bookofmormon.online/mormon/69"
    },
    {
      "seq": "1529",
      "time": "2023-03-12T17:05:19.000Z",
      "content": "How are sins like debts? https://bookofmormon.online/jesus/81"
    },
    {
      "seq": "580",
      "time": "2023-03-12T23:56:45.000Z",
      "content": "What do these examples tell us about Amaleki and his message? https://bookofmormon.online/land-of-nephi/41"
    },
    {
      "seq": "261",
      "time": "2023-03-13T06:48:10.000Z",
      "content": "When the Lord says he will lift up his hand to the Gentiles (verse 6), what does he mean? What do you think is the significance of lifting up the hand? https://bookofmormon.online/jacobs-sermon/3"
    },
    {
      "seq": "1733",
      "time": "2023-03-13T13:39:36.000Z",
      "content": "Are there fewer miracles today than in times past? If so, what does that tell us about ourselves? If we perceive that fewer miracles are done, does that say something of the same sort? https://bookofmormon.online/moroni/25"
    },
    {
      "seq": "976",
      "time": "2023-03-13T20:31:02.000Z",
      "content": "In what sense is Alma “unfolding the scriptures”? https://bookofmormon.online/reign-of-judges/ammonihah/82"
    },
    {
      "seq": "1445",
      "time": "2023-03-14T03:22:27.000Z",
      "content": "Is the knowledge referred to here the same as that mentioned at the end of verse 20? https://bookofmormon.online/mormon/52"
    },
    {
      "seq": "1442",
      "time": "2023-03-14T10:13:53.000Z",
      "content": "How is Mormon using the word surely? When we use it, it usually indicates some previous doubt. Is that what he is implying? https://bookofmormon.online/mormon/52"
    },
    {
      "seq": "13",
      "time": "2023-03-14T17:05:19.000Z",
      "content": "Compare verse 7 to D&C 124:49. How do you explain the difference between the teachings of these verses? https://bookofmormon.online/lehites/23"
    },
    {
      "seq": "561",
      "time": "2023-03-14T23:56:45.000Z",
      "content": "Though the words joy and saints are frequently referred to in scripture, this is the only place where the phrase “the joy of the saints” occurs. What do you think it means? https://bookofmormon.online/land-of-nephi/29"
    },
    {
      "seq": "905",
      "time": "2023-03-15T06:48:10.000Z",
      "content": "What do you make of the fact that wearing costly apparel is the sign of Nephite pride? To what could we compare this in our own day? https://bookofmormon.online/reign-of-judges/45"
    },
    {
      "seq": "1776",
      "time": "2023-03-15T13:39:36.000Z",
      "content": "How does hope make us sure and steadfast? How does it cause us to be “abounding in good works”? https://bookofmormon.online/jaredites/151"
    },
    {
      "seq": "1379",
      "time": "2023-03-15T20:31:02.000Z",
      "content": "What does this verse tell us about Nephite righteousness? If we are righteous because we have been humbled by circumstances and finally see the need for the Lord, how righteous are we? https://bookofmormon.online/nephi/67"
    },
    {
      "seq": "454",
      "time": "2023-03-16T03:22:27.000Z",
      "content": "To what does “this is the doctrine of Christ” refer? Does it refer to what Nephi teaches in verse 6? https://bookofmormon.online/nephis-testimony/12"
    },
    {
      "seq": "462",
      "time": "2023-03-16T10:13:53.000Z",
      "content": "What does it mean to glory in Jesus? Do we glory in Jesus? How? https://bookofmormon.online/nephis-testimony/18"
    },
    {
      "seq": "1313",
      "time": "2023-03-16T17:05:19.000Z",
      "content": "When Mormon says that the gulf is prepared to engulf the wicked, is he personifying it (as if to say the gulf is waiting to do this), or is he saying it has been prepared to engulf them? https://bookofmormon.online/gadianton/19"
    },
    {
      "seq": "667",
      "time": "2023-03-16T23:56:45.000Z",
      "content": "or to fight and quarrel with each other and serve the devil but we will teach them to “walk in the ways of truth and soberness” (what are those ways? what does it mean for our children to be sober?) https://bookofmormon.online/benjamin/71"
    },
    {
      "seq": "1073",
      "time": "2023-03-17T06:48:10.000Z",
      "content": "Alma speaks here of his desires and what he should desire. How is that related to what he has just said about desire? https://bookofmormon.online/reign-of-judges/88"
    },
    {
      "seq": "180",
      "time": "2023-03-17T13:39:36.000Z",
      "content": "Jacob is in the wilderness of a new land and presumably has little chance to tell very many others this gospel. So why does Lehi tell Jacob that it is important to make these things known to everyone? https://bookofmormon.online/promised-land/lehi/22"
    },
    {
      "seq": "1765",
      "time": "2023-03-17T20:31:02.000Z",
      "content": "What difference would it make for us to think of truth as what persuades people to do good? If we thought of it that way, could we also justify portraying the facts inaccurately, lying? https://bookofmormon.online/moroni/48"
    },
    {
      "seq": "755",
      "time": "2023-03-18T03:22:27.000Z",
      "content": "Notice how the parallel grammatical structure creates an “equation” between “the truth” and “the word of God,” and between the people’s anger and Noah’s judgment that Abinadi is mad. https://bookofmormon.online/recolonization/41"
    },
    {
      "seq": "122",
      "time": "2023-03-18T10:13:53.000Z",
      "content": "Why does Nephi make only one arrow? Why didn’t anyone else in the group think to make a new bow and arrow? https://bookofmormon.online/lehites/121"
    },
    {
      "seq": "1603",
      "time": "2023-03-18T17:05:19.000Z",
      "content": "What does it mean that kings will shut their mouths? What will they see that they hadn’t been told of? What will they consider that they hadn’t heard? https://bookofmormon.online/jesus-teachings/30"
    },
    {
      "seq": "870",
      "time": "2023-03-18T23:56:45.000Z",
      "content": "Is it significant that Benjamin delivered that address to a people who were diligent in keeping the commandments but that it also seems to apply to someone like Alma who has openly rebelled against those commandments? https://bookofmormon.online/zarahemla/77"
    },
    {
      "seq": "1771",
      "time": "2023-03-19T06:48:10.000Z",
      "content": "In most places the veil is spoken of as something that is removed. Here it is spoken of as something we must remove. Is this verse talking about the same veil we refer to when we speak of the veil between ourselves and the Father? https://bookofmormon.online/moroni/52"
    },
    {
      "seq": "272",
      "time": "2023-03-19T13:39:36.000Z",
      "content": "After the Lord speaks to them of his power to redeem and deliver, what might Israel think of when he mentions his power to dry up the sea? https://bookofmormon.online/jacobs-sermon/9"
    },
    {
      "seq": "1409",
      "time": "2023-03-19T20:31:02.000Z",
      "content": "What does it mean for our hearts to swell with great pride unto boasting and unto great swelling? Why is the phrase so repetitive? About what would we boast? How does pride bring envy? https://bookofmormon.online/samuel/16"
    },
    {
      "seq": "994",
      "time": "2023-03-20T03:22:27.000Z",
      "content": "Alma has just concluded a sermon on repentance and the plan of salvation. Now he asks his listeners to recall when those commandments were given. Why does he ask them to look forward to that time? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "202",
      "time": "2023-03-20T10:13:53.000Z",
      "content": "Why does Lehi add “according to the things which I have read”? Does this perhaps suggest that he wasn’t familiar with the story of Adam and Eve until he read the brass plates? https://bookofmormon.online/promised-land/lehi/33"
    },
    {
      "seq": "138",
      "time": "2023-03-20T17:05:19.000Z",
      "content": "What does it mean to say that the Lord remembers his covenants? What does Nephi’s teaching in this verse suggest about us today? About our children? https://bookofmormon.online/lehites/150"
    },
    {
      "seq": "704",
      "time": "2023-03-20T23:56:45.000Z",
      "content": "Why do we have to be called by some name or other? What other name or names might we be called by? What does it mean to be called by one of these other names? https://bookofmormon.online/benjamin/96"
    },
    {
      "seq": "1215",
      "time": "2023-03-21T06:48:10.000Z",
      "content": "Why must we bridle our passions in order to be filled with love? What does it mean to bridle the passions? All passions or particular ones? If particular ones, which ones? https://bookofmormon.online/reign-of-judges/shiblon/6"
    },
    {
      "seq": "766",
      "time": "2023-03-21T13:39:36.000Z",
      "content": "The parallel grammar compares those who believe to those to whom the Lord’s arm (his power) has been revealed. How is this so? https://bookofmormon.online/recolonization/abinadi/21"
    },
    {
      "seq": "563",
      "time": "2023-03-21T20:31:02.000Z",
      "content": "What is supplication? What has it to do with his hunger of soul? https://bookofmormon.online/land-of-nephi/30"
    },
    {
      "seq": "28",
      "time": "2023-03-22T03:22:27.000Z",
      "content": "How does Nephi’s desire to know what his father had seen (see 1 Nephi 10:17), presumably a desire expressed in prayer, differ from his prayer in 1 Nephi 2:16? https://bookofmormon.online/lehites/96"
    },
    {
      "seq": "1791",
      "time": "2023-03-22T10:13:53.000Z",
      "content": "Here he illustrates hope. How is this example of hope particularly appropriate? https://bookofmormon.online/moroni/77"
    },
    {
      "seq": "1527",
      "time": "2023-03-22T17:05:19.000Z",
      "content": "Verse 8 tells us that the Father knows before we ask what we need. Verse 9 says therefore we should pray in the manner to be described. Why does the Father’s knowledge of our needs mean that we should pray in that way? https://bookofmormon.online/jesus/80"
    },
    {
      "seq": "1225",
      "time": "2023-03-22T23:56:45.000Z",
      "content": "What does vain mean? What does foolish mean? What kinds of vain or foolish things might we be led away by? https://bookofmormon.online/reign-of-judges/corianton/4"
    },
    {
      "seq": "1200",
      "time": "2023-03-23T06:48:10.000Z",
      "content": "What does it mean to enlarge a people’s memory? How has doing so convinced people of the error of their ways? Why were the records essential to the conversion work that Ammon and the other missionaries did? How do we enlarge our memory? https://bookofmormon.online/reign-of-judges/helaman/14"
    },
    {
      "seq": "894",
      "time": "2023-03-23T13:39:36.000Z",
      "content": "To what group does “this people” refer? https://bookofmormon.online/reign-of-judges/6"
    },
    {
      "seq": "540",
      "time": "2023-03-23T20:31:02.000Z",
      "content": "The servant dissuades him. They dig about and nourish all the trees in the vineyard. https://bookofmormon.online/olive-tree/20"
    },
    {
      "seq": "712",
      "time": "2023-03-24T03:22:27.000Z",
      "content": "What does it mean to be sealed Christ’s? How is it that being steadfast and immovable as well as abounding in good works make it possible for us to be sealed Christ’s? https://bookofmormon.online/benjamin/101"
    },
    {
      "seq": "551",
      "time": "2023-03-24T10:13:53.000Z",
      "content": "How are these two verses related to each other? One way to think about that is to ask what to make of the word wherefore at the beginning of verse 5. https://bookofmormon.online/olive-tree/46"
    },
    {
      "seq": "1065",
      "time": "2023-03-24T17:05:19.000Z",
      "content": "What does Ammon find amazing about the gospel? How does that apply to him personally? To the Anti-Nephi-Lehies? To us? https://bookofmormon.online/ammon/146"
    },
    {
      "seq": "156",
      "time": "2023-03-24T23:56:45.000Z",
      "content": "What is the role of the Gentiles? https://bookofmormon.online/brass-plates/15"
    },
    {
      "seq": "725",
      "time": "2023-03-25T06:48:10.000Z",
      "content": "How does the description of Noah at the beginning of the verse contrast with Mosiah 5:2? https://bookofmormon.online/recolonization/25"
    },
    {
      "seq": "114",
      "time": "2023-03-25T13:39:36.000Z",
      "content": "In verse 2, Nephi explains why they find the truth to be hard. Which meaning of hard is relevant, “difficult to understand” or “difficult to bear”? https://bookofmormon.online/lehites/109"
    },
    {
      "seq": "910",
      "time": "2023-03-25T20:31:02.000Z",
      "content": "In these chapters we have two magnificent sermons by Alma the Younger, more than enough material for several Sunday School lessons. These study questions will focus on chapter 5, with a few things also from chapter 7. https://bookofmormon.online/reign-of-judges/49"
    },
    {
      "seq": "1240",
      "time": "2023-03-26T03:22:27.000Z",
      "content": "What does it mean to be in a state of nature? Since the Church does not believe the doctrine of original sin—that we naturally desire to do evil—Alma must be saying something different here. What is he saying? https://bookofmormon.online/reign-of-judges/corianton/23"
    },
    {
      "seq": "1458",
      "time": "2023-03-26T10:13:53.000Z",
      "content": "Why does he give them this catalogue of destruction? https://bookofmormon.online/jesus/14"
    },
    {
      "seq": "1580",
      "time": "2023-03-26T17:05:19.000Z",
      "content": "Jesus was known as Jehovah in the times of the Old Testament. He was prayed to many times by that name. What is different now? https://bookofmormon.online/jesus/159"
    },
    {
      "seq": "679",
      "time": "2023-03-26T23:56:45.000Z",
      "content": "At what point can we deny the beggar because we cannot give to him? How little can we have? https://bookofmormon.online/benjamin/83"
    },
    {
      "seq": "210",
      "time": "2023-03-27T06:48:10.000Z",
      "content": "Why does Lehi use the present tense here: “They are redeemed from the fall” (italics added)? https://bookofmormon.online/promised-land/lehi/38"
    },
    {
      "seq": "1400",
      "time": "2023-03-27T13:39:36.000Z",
      "content": "What are the glad tidings that the angel brought him and that he hoped the Nephites would receive? https://bookofmormon.online/samuel/3"
    },
    {
      "seq": "255",
      "time": "2023-03-27T20:31:02.000Z",
      "content": "Why does Jacob remind them that he was consecrated by Nephi when he tells them of his priesthood calling? https://bookofmormon.online/jacobs-sermon/1"
    },
    {
      "seq": "744",
      "time": "2023-03-28T03:22:27.000Z",
      "content": "Notice how the people seem to admit they have been included in the prophecy by including themselves in their excusing. https://bookofmormon.online/recolonization/34"
    },
    {
      "seq": "287",
      "time": "2023-03-28T10:13:53.000Z",
      "content": "If verses 9–11 are Israel’s prayer for deliverance, these verses are the answer to the prayer. How are that prayer and this answer relevant to the Nephites? To us? https://bookofmormon.online/jacobs-sermon/16"
    },
    {
      "seq": "974",
      "time": "2023-03-28T17:05:19.000Z",
      "content": "Why does Alma tell them of the redemption of the body? How does this function in his call to repentance? https://bookofmormon.online/reign-of-judges/ammonihah/77"
    },
    {
      "seq": "1820",
      "time": "2023-03-28T23:56:45.000Z",
      "content": "What question might have prompted Mormon to write this? (Compare Mormon 9:7–21.) https://bookofmormon.online/downfall/48"
    },
    {
      "seq": "1427",
      "time": "2023-03-29T06:48:10.000Z",
      "content": "Faith and repentance bring a change of heart in the Lamanites. What is a change of heart? How might our hearts be changed? https://bookofmormon.online/samuel/42"
    },
    {
      "seq": "606",
      "time": "2023-03-29T13:39:36.000Z",
      "content": "Why does Benjamin say that the Father lends us breath? https://bookofmormon.online/benjamin/13"
    },
    {
      "seq": "1033",
      "time": "2023-03-29T20:31:02.000Z",
      "content": "How is Ammon’s sermon to Lamoni related to King Benjamin’s sermon in Mosiah 4? https://bookofmormon.online/ammon/53"
    },
    {
      "seq": "295",
      "time": "2023-03-30T03:22:27.000Z",
      "content": "What does it mean to say that Israel has no sons to guide her (verse 18)? Notice that in verse 19 the only two sons remaining are desolation and destruction. What does that mean? https://bookofmormon.online/jacobs-sermon/17"
    },
    {
      "seq": "231",
      "time": "2023-03-30T10:13:53.000Z",
      "content": "To whom is this verse referring? https://bookofmormon.online/promised-land/lehi/70"
    },
    {
      "seq": "1627",
      "time": "2023-03-30T17:05:19.000Z",
      "content": "Of all the things the Lord could have taken the time to mention, why does he mention tithing? https://bookofmormon.online/jesus/190"
    },
    {
      "seq": "467",
      "time": "2023-03-30T23:56:45.000Z",
      "content": "To what does “words of the Jews” refer? How does one respect those words? Could an anti-Semite respect the words of the Jews? (Reread 2 Nephi 29:4–5.) https://bookofmormon.online/nephis-testimony/20"
    },
    {
      "seq": "531",
      "time": "2023-03-31T06:48:10.000Z",
      "content": "The master prunes it, digs about it, and nourishes it, hoping it will send out new shoots. https://bookofmormon.online/olive-tree/3"
    },
    {
      "seq": "939",
      "time": "2023-03-31T13:39:36.000Z",
      "content": "The scriptures sometimes speak, as Alma does here, of the wages of sin. (See, for example, Romans 6:23.) Why don’t they speak of the wages of righteousness? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/25"
    },
    {
      "seq": "964",
      "time": "2023-03-31T20:31:02.000Z",
      "content": "Might these verses say anything to us about our own day? https://bookofmormon.online/reign-of-judges/ammonihah/47"
    },
    {
      "seq": "918",
      "time": "2023-04-01T03:22:27.000Z",
      "content": "Why doesn’t Alma include such things as baptism and the gift of the Holy Ghost, or keeping the commandments, in his description of salvation? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/8"
    },
    {
      "seq": "996",
      "time": "2023-04-01T10:13:53.000Z",
      "content": "How does the manner of ordaining priests teach people how to look forward to Christ for redemption? https://bookofmormon.online/reign-of-judges/ammonihah/antioniah/15"
    },
    {
      "seq": "269",
      "time": "2023-04-01T17:05:19.000Z",
      "content": "To whom is the Lord speaking in this verse and the next? https://bookofmormon.online/jacobs-sermon/9"
    },
    {
      "seq": "1257",
      "time": "2023-04-01T23:56:45.000Z",
      "content": "What does it mean to be brought to the dust in humility? (How, for example, does that differ from depression?) https://bookofmormon.online/reign-of-judges/corianton/40"
    },
    {
      "seq": "351",
      "time": "2023-04-02T06:48:10.000Z",
      "content": "What covenants is Nephi referring to? The Abrahamic covenant? Covenants with the children of Israel? Covenants with Lehi? https://bookofmormon.online/land-of-nephi/8"
    },
    {
      "seq": "1204",
      "time": "2023-04-02T13:39:36.000Z",
      "content": "If the abominations are to be revealed, why not also the covenants, agreements, signs, and wonders that went with those abominations? https://bookofmormon.online/reign-of-judges/helaman/21"
    },
    {
      "seq": "1244",
      "time": "2023-04-02T20:31:02.000Z",
      "content": "Here we seem to see Mormon’s interjection: “thus we see.” How does the story of Adam and Eve help us see that earth life is a time of probation? https://bookofmormon.online/reign-of-judges/corianton/29"
    },
    {
      "seq": "565",
      "time": "2023-04-03T03:22:27.000Z",
      "content": "Enos asks, “How?” and the Lord replies, “Because . . .” How can because answer a how question? What does it mean to “go to”? (Compare Genesis 11:7.) What is the Lord commanding Enos? https://bookofmormon.online/land-of-nephi/31"
    },
    {
      "seq": "654",
      "time": "2023-04-03T10:13:53.000Z",
      "content": "Once again, Benjamin repeats what he has been saying in different words. Why is this threefold repetition necessary? https://bookofmormon.online/benjamin/70"
    },
    {
      "seq": "1117",
      "time": "2023-04-03T17:05:19.000Z",
      "content": "Alma asks them to decide whether the person who knows and doesn’t do is worse than the person who only believes and doesn’t do. Why must they decide? Doesn’t he tell them the answer in the last clause of verse 20? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/8"
    },
    {
      "seq": "1038",
      "time": "2023-04-03T23:56:45.000Z",
      "content": "What explains the animosity of the Lamanites toward the Nephites? Is their accusation based in fact? Why would conversion to the gospel be the only possible remedy for the accusation? https://bookofmormon.online/ammon/89"
    },
    {
      "seq": "816",
      "time": "2023-04-04T06:48:10.000Z",
      "content": "What’s the difference between these people who fight for their freedom so unsuccessfully and the people of General Moroni’s time who fight for their freedom successfully? https://bookofmormon.online/recolonization/84"
    },
    {
      "seq": "1835",
      "time": "2023-04-04T13:39:36.000Z",
      "content": "In verse 24 Moroni explicitly turns his attention to everyone rather than only to the Lamanites; he makes a general exhortation. What are its main elements? How do those elements compare to what he has said specifically to the Lamanites? https://bookofmormon.online/moroni/110"
    },
    {
      "seq": "1799",
      "time": "2023-04-04T20:31:02.000Z",
      "content": "What is the significance of using the passive voice—“shalt be made strong”—rather than the active—“will become strong”? What does “shalt be made strong even unto the sitting down” mean? https://bookofmormon.online/moroni/79"
    },
    {
      "seq": "488",
      "time": "2023-04-05T03:22:27.000Z",
      "content": "What bothers Jacob about what he is going to say? Why does he shrink with shame (verse 6) when he seems not to have done anything wrong, and why should his soul be burdened (verse 9)? https://bookofmormon.online/jacobs-address/3"
    },
    {
      "seq": "825",
      "time": "2023-04-05T10:13:53.000Z",
      "content": "Why is it so important for the young people to understand King Benjamin’s words? Is there something about that specific sermon that is essential to them? https://bookofmormon.online/zarahemla/51"
    },
    {
      "seq": "345",
      "time": "2023-04-05T17:05:19.000Z",
      "content": "Does this answer the previous question? How? Why would knowing that our knowledge is from God mean that we ought not to hang down our heads? (Compare this to 2 Nephi 4:26ff.) https://bookofmormon.online/jacobs-sermon/50"
    },
    {
      "seq": "292",
      "time": "2023-04-05T23:56:45.000Z",
      "content": "In whose mouth have the words of verse 16 been put? Israel’s? Isaiah’s? What does it mean to be covered in the shadow of God’s hand? https://bookofmormon.online/jacobs-sermon/16"
    },
    {
      "seq": "1180",
      "time": "2023-04-06T06:48:10.000Z",
      "content": "Why did the people kill Zenock? How is would used in “the people would not understand”? What does that word tell us? https://bookofmormon.online/reign-of-judges/zoramites/almas-teachings/44"
    },
    {
      "seq": "186",
      "time": "2023-04-06T13:39:36.000Z",
      "content": "Notice that this verse speaks of the law as something that the Father has given. What does that mean? https://bookofmormon.online/promised-land/lehi/24"
    },
    {
      "seq": "674",
      "time": "2023-04-06T20:31:02.000Z",
      "content": "In what ways do we say this? https://bookofmormon.online/benjamin/76"
    },
    {
      "seq": "1369",
      "time": "2023-04-07T03:22:27.000Z",
      "content": "Why does Nephi mention all these prophets? How will that be convincing? Who would be convinced by such evidence? https://bookofmormon.online/nephi/25"
    },
    {
      "seq": "1271",
      "time": "2023-04-07T10:13:53.000Z",
      "content": "Why does Moroni give back the weapons of the Lamanites, knowing that they are going to use them to kill his people? https://bookofmormon.online/war/29"
    },
    {
      "seq": "1343",
      "time": "2023-04-07T17:05:19.000Z",
      "content": "Given what we’ve seen so far in the Book of Mormon, as soon as we read that the Nephites and Lamanites “became exceedingly rich,” what do we expect to read about soon? Has Mormon written this to elicit that expectation from us? https://bookofmormon.online/gadianton/75"
    },
    {
      "seq": "243",
      "time": "2023-04-07T23:56:45.000Z",
      "content": "Why is enemy singular in verse 27 and plural in verse 29? https://bookofmormon.online/promised-land/48"
    },
    {
      "seq": "142",
      "time": "2023-04-08T06:48:10.000Z",
      "content": "Why do the scriptures so often use verbs of hearing, such as hearken, to talk about obedience? https://bookofmormon.online/promised-land/9"
    },
    {
      "seq": "1587",
      "time": "2023-04-08T13:39:36.000Z",
      "content": "What does it mean that those who have faith have been given to him? If we have faith, in what sense have we been given to him? How do we belong to him? https://bookofmormon.online/jesus/164"
    },
    {
      "seq": "157",
      "time": "2023-04-08T20:31:02.000Z",
      "content": "How does this promise compare to the prophecy in the last part of chapter 13? https://bookofmormon.online/brass-plates/15"
    },
    {
      "seq": "556",
      "time": "2023-04-09T03:22:27.000Z",
      "content": "Why does Enos mention that his father taught him his language? Surely all parents teach their children their language. What point is Enos making? https://bookofmormon.online/land-of-nephi/29"
    },
    {
      "seq": "1399",
      "time": "2023-04-09T10:13:53.000Z",
      "content": "What does Samuel mean by “the sword of justice”? https://bookofmormon.online/samuel/1"
    },
    {
      "seq": "262",
      "time": "2023-04-09T17:05:19.000Z",
      "content": "What does “set up my standard” mean? As it is used here, a standard is a flag. Of what might it be a symbol here? What does the Lord mean when he says he will set up his standard to the people? https://bookofmormon.online/jacobs-sermon/3"
    },
    {
      "seq": "537",
      "time": "2023-04-09T23:56:45.000Z",
      "content": "The tree into which the wild branches were grafted bears good fruit, fruit like the natural fruit. The tree has been saved. https://bookofmormon.online/olive-tree/10"
    },
    {
      "seq": "337",
      "time": "2023-04-10T06:48:10.000Z",
      "content": "How does verse 50 help explain this verse? What is of value? What is free? What is of no worth? https://bookofmormon.online/jacobs-sermon/42"
    },
    {
      "seq": "1074",
      "time": "2023-04-10T13:39:36.000Z",
      "content": "How is what Alma says here related to Moses 1:39? https://bookofmormon.online/reign-of-judges/89"
    },
    {
      "seq": "1059",
      "time": "2023-04-10T20:31:02.000Z",
      "content": "Why is it significant that none of the Nehors were converted? Mormon, the editor, interrupts the narrative here to write in his own voice: “And thus we can plainly discern.” How is Mormon’s observation important to us? https://bookofmormon.online/ammon/124"
    },
    {
      "seq": "1196",
      "time": "2023-04-11T03:22:27.000Z",
      "content": "How are verses 28–29 (and therefore also verse 3) a type for what Alma says in this verse? https://bookofmormon.online/reign-of-judges/helaman/10"
    },
    {
      "seq": "1297",
      "time": "2023-04-11T10:13:53.000Z",
      "content": "What causes the eventual defeat of the Nephites? Does this mean anything for us? https://bookofmormon.online/war/151"
    },
    {
      "seq": "1779",
      "time": "2023-04-11T17:05:19.000Z",
      "content": "When Moroni says that Christ showed himself to the fathers by faith, does he mean by their faith or by Christ’s? https://bookofmormon.online/moroni/68"
    },
    {
      "seq": "1245",
      "time": "2023-04-11T23:56:45.000Z",
      "content": "What is the significance of the fact that Adam and Eve were allowed to follow their own will? Is it significant that Alma speaks of their will rather than of their wills? https://bookofmormon.online/reign-of-judges/corianton/31"
    },
    {
      "seq": "1450",
      "time": "2023-04-12T06:48:10.000Z",
      "content": "What does it mean to say there were many officers? What would the modern equivalent of Nephite officers be? https://bookofmormon.online/gadianton/167"
    },
    {
      "seq": "1057",
      "time": "2023-04-12T13:39:36.000Z",
      "content": "Why do the Anti-Nephi-Lehies go out to meet the Lamanites? Wouldn’t it have been better to wait for them to arrive? The covenant that they made didn’t require that they offer themselves for slaughter, did it? https://bookofmormon.online/ammon/120"
    },
    {
      "seq": "914",
      "time": "2023-04-12T20:31:02.000Z",
      "content": "Alma announces his theme, the conditions of salvation. Compare this sermon to King Benjamin’s sermon in Mosiah 4. How are they different? How are they the same? https://bookofmormon.online/reign-of-judges/zarahemla-sermon/7"
    },
    {
      "seq": "1242",
      "time": "2023-04-13T03:22:27.000Z",
      "content": "What do these verses offer Corianton? Why are they important advice to him? Given what Alma has taught about restoration so far, why isn’t it too late for Corianton to be merciful? https://bookofmormon.online/reign-of-judges/corianton/25"
    },
    {
      "seq": "80",
      "time": "2023-04-13T10:13:53.000Z",
      "content": "To what is the angel referring when he points to “the nations and kingdoms of the Gentiles”? https://bookofmormon.online/lehites/nephis-vision/30"
    },
    {
      "seq": "646",
      "time": "2023-04-13T17:05:19.000Z",
      "content": "How is what they ask for related to being diligent in keeping the commandments? https://bookofmormon.online/benjamin/60"
    },
    {
      "seq": "1734",
      "time": "2023-04-13T23:56:45.000Z",
      "content": "Is this the same promise made to Nephi (in Helaman 10:5)? https://bookofmormon.online/moroni/26"
    },
    {
      "seq": "1426",
      "time": "2023-04-14T06:48:10.000Z",
      "content": "At the end of the verse Samuel says “for this intent hath the Lord prolonged their days.” For what intent? Whose days? https://bookofmormon.online/samuel/41"
    },
    {
      "seq": "387",
      "time": "2023-04-14T13:39:36.000Z",
      "content": "What does Nephi mean when he says that after Christ fulfills the law they will not need to harden their hearts against him? Does that mean they harden their hearts because of the law? If so, how so? If not, why not? https://bookofmormon.online/nephis-teachings/12"
    }
  ]

  const postdata2 = [
  {
    "seq": "387",
    "time": "2022-04-14T13:39:36.000Z",
    "content": "What does Nephi mean when he says that after Christ fulfills the law they will not need to harden their hearts against him? Does that mean they harden their hearts because of the law? If so, how so? If not, why not? https://bookofmormon.online/nephis-teachings/12"
  }
]


for(let item of postdata)
{
    let value = await schedulePost(item.time,item.content);
    if(value.ok)
    {
      console.log(`${item.seq}\t${value.post_id}`)
    }
}