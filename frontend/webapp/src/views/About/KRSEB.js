import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Label } from "reactstrap";
import { label } from "src/models/Utils";
import "./KRSEB.css"


export default function KRSEB() {
    useEffect(()=>document.title =  "특별반 | " + label("home_title"),[])
    return (
        <div className="container krseb">

            <img className="banner" src="https://i.imgur.com/dDqFPn5.png" />
            <Card>
                <CardBody className="KRSEBDesc">

                    <div className="description">
                        <h2>몰몬경—특별반</h2>
                        <p>몰몬경—특별반은 후기성도판 몰몬경에 더 쉽고 흥미롭게 다가갈 수 있도록 제작되었다. 문단, 인용 부호, 시 구문, 내용별 소제목, 위첨자 절번호 등과 같은 유용한 요소들이 이미 수 십년전부터 현재까지 일반 표준성경에서 활용되고 있다. 이제 이 특별판을 통해서 이러한 표기가 처음으로 몰몬경에서도 등장하게 되었다. 특히 각주의 내용은 몰몬경에 조예가 깊은 후기성도가 최근의 연구 결과를 반영하였으며 핵심적이고 엄선된 내용을 간략 명료하게 정리해서 몰몬경의 이해를 돕고자 하였다. 그렇지만 주된 초점은 항상 몰몬경의 원문에서 벗어나지 않는 것이다. 위에서 언급한 모든 요소들은 원문의 자구, 구성, 상호연결을 부각시켜서 몰몬경의 거룩한 메시지가 새롭게 이해될 수 있도록 특별히 마련되었다.</p>
                        <p>장과 절을 나누는 방식은 공식 몰몬경과 동일하지만 추가적으로 내용을 기반한 소분류를 통해 가시적인 이해를 도모한다. 큰 활자로 된 소제목은 여러 장에 걸쳐 있는 내용(설교, 담화, 인용, 이차적인 이야기 등)의 시작과 끝을 나타낸다. 작은 활자로 된 소제목은 좀 더 구체적으로 누가 어떤 이야기를 무슨 주제로 하는지 한 눈에 파악할 수 있게 구분해준다. 이들 각각의 소제목은 속해있는 내용을 사건의 추이와 원문의 구조에 따라 최대한 면밀하게 압축해서 전달하고자 한다. 독자들은 이 특별판을 읽을 때 추가된 소제목이 단지 내용을 근거로 한 글귀라는 것을 명심하고 제목 자체에 인증이나 권위를 부여하지 않아야 한다.</p>
                        <p>몰몬경 한국어 특별판은 2019년 1월에 출판된 Maxwell Institute Study Edition을 기반으로 출간되었다. Maxwell Institute Study Edition은 브리검 영 대학교(Brigham Young University) 소속 맥스웰 연구소(Maxwell Institute)와 동일 대학 소속 종교연구학회(Religious Studies Center)가 자문과 감수를 맡았다. 편집과 인쇄는 데저레트북(Deseret Book)이 출판하였고 내용 편집자인 그랜트 하디(Grant Hardy)가 참여하여 공동으로 제작된 새로운 형식을 갖춘 몰몬경이다.</p>

                    </div>
                    <div className="product">
                        <img src={"https://i.imgur.com/tvy7Haf.png"} />
                        <Label>21,000 원 <span>(실가)</span></Label>
                        <Button onClick={window.clicky?.goal("kr_buy")} color="success" target="_blank" href={"https://www.bookk.co.kr/book/view/71999"} >종이책 구매하기</Button>
                        <Button onClick={window.clicky?.goal("kr_download")}  color="info" target="_blank" href={"https://media.bookofmormon.online/fax/pdf/%EB%AA%B0%EB%AA%AC%EA%B2%BD%E2%80%94%ED%8A%B9%EB%B3%84%ED%8C%90"} >무료 다운로드</Button>
                        
                    </div>
                </CardBody>
            </Card>

            <KRSEBiFrame />

        </div>
    );

}



function KRSEBiFrame() {
    return <>
        <iframe className="krsebiframe" allowfullscreen="allowfullscreen"
            src={`https://designrr.page?id=181226&token=4131333782&type=FP&h=7580`} frameborder="0"></iframe></>

}