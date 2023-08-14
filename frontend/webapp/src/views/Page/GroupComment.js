import React from 'react';
// IMAGE 

export default function GroupComment() {
    return null
    return (
        <div className="study">
            <div className="sectionfooter ">
                <div className="comment">
                    <div className="avatar" style={{ float: 'left' }}>
                        <img src={null} alt="Circle Image" className="img-circle img-no-padding img-responsive" />
                    </div>
                    <div className="commentcontainer">
                        <div className="commentcontent">
                            <a className="name">First Name</a>
                            <div className="contenttext">Maecenas ut fermentum libero, vel dignissim metus. Nam accumsan in risus et
          commodo. </div>
                        </div>
                    </div>
                    <div className="commentfooter">
                        <div className="response">Like</div>
                        <div className="reply">Reply</div>
                        <div className>•</div>
                        <div className>Today at 5:32pm</div>
                    </div>
                </div>
                <div className="mycomment form-group">
                    <div className="avatar" style={{ float: 'left' }}>
                        <img src={null} alt="Circle Image" className="img-circle img-no-padding img-responsive" />
                    </div>
                    <textarea className="form-control textarea" defaultValue={"Write a comment..."} />
                </div>
            </div>
        </div>

    )
}
