import React, { useEffect } from 'react';
import { useRouteMatch,useParams,Link } from 'react-router-dom';
import  './Witnesses.css';
import { label } from '../../models/Utils';
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import moment from 'moment';
import { Button } from 'reactstrap';

export default function JosephSmith() {
    
    return <div className="container " style={{ display: 'block' }}>
            <div id="page" className='single-witnesses' >
                    <h3 className="title lg-4 text-center">Joseph Smith</h3>
                    <div className='witness-image'>
                        <img src={`${assetUrl}/history/witnesses/people/joseph-smith.jpg`} alt="Joseph Smith" />
                    </div>
            </div>
        </div>

}