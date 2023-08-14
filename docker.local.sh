#LOAD VARS FROM .ENV FILE
export $(egrep -v '^#' .env | xargs)
CONTAINER=BookofMormonOnline
echo $REGISTRY_ID
docker builder prune -f
docker build -t $REGISTRY_ID .
docker stop $CONTAINER
docker rm  $CONTAINER
docker run --env-file .dockerenv --network kckern -p 5000:5000 -d --name  $CONTAINER $REGISTRY_ID

# push to dockerhub
#aws ecr get-login-password --region us-west-2 --profile bomonlineapi | docker login --username AWS --password-stdin $REGISTRY_ID
#docker push $REGISTRY_ID