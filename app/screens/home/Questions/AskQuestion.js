import React from 'react';
import {  View,Icon,Tab,TabHeading,Tabs } from 'native-base';
import { StyleSheet, FlatList, TouchableOpacity, Keyboard, Alert, AsyncStorage,ScrollView,Text } from 'react-native';
import { RkComponent, RkTheme, RkText, RkAvoidKeyboard,RkStyleSheet, RkButton, RkCard, RkTextInput } from 'react-native-ui-kitten';
import { NavigationActions } from 'react-navigation';
import { Service } from '../../../services';
import ReactMoment from 'react-moment';
import Moment from 'moment';
import { Avatar } from '../../../components';
import firebase from '../../../config/firebase';

const questionTable = 'AskedQuestions';
var firestoreDB = firebase.firestore();
export default class AskQuestion extends RkComponent {

    constructor(props) {
        super(props);
        this.sessionDetails = this.props.navigation.state.params.sessionDetails;
        this.state = {
            Question: "",
            sessionDetails :this.sessionDetails ,
            currentUser: {},
            sessionId: this.sessionDetails.key,
            topQueView : false,
            recentQueView :true,
            questionData : [],
            orderBy : 'timestamp',
            currentUid : "",
            queAccess : "",
            questionStatus : false
        }
    }
    componentWillMount() {
        let thisRef = this;
        Service.getCurrentUser((userDetails) => {
            thisRef.setState({
              currentUser: userDetails,
              currentUid : userDetails.uid
            });
          });
          this.checkSessionTime();
          this.getQuestions();
    }
    checkSessionTime = () => {
        let session = this.state.sessionDetails;
        let today = Moment(new Date()).format("DD MMM,YYYY hh:mm A");
        let sessionStart = Moment(session.startTime).format("DD MMM,YYYY hh:mm A");
        let sessionEnd = Moment(session.endTime).format("DD MMM,YYYY hh:mm A");
        let bufferedEnd = Moment(sessionEnd).add(2,'hours');
            if(sessionStart <= today && bufferedEnd >= today){
                this.setState({
                    queAccess : "auto"
                })
            }
            else{
                this.setState({
                    queAccess : "none"
                })
                Alert.alert("Questions can be asked only when session is active")
            }
        
    }
    getQuestions = (order) => {
        if (order == undefined) {
            order = 'timestamp';
        }
        let sessionId = this.state.sessionId;
        let orderByObj = order;
        let thisRef = this;
        let Data = [];
        Service.getDocRef(questionTable)
        .where("SessionId" , "==" , sessionId )
        .orderBy(orderByObj , 'desc')
        .get()
        .then(function(docRef){
            if(docRef.size > 0){
                docRef.forEach(doc => {
                    Data.push({questionSet :doc.data(), questionId : doc.id});
                })
                thisRef.setState({questionData : Data})              
            }
            else{
                thisRef.setState({questionStatus : true})    
            }     
         })
         .catch(function (error){
            console.error("Error adding document: ", error);
         });
    }
    onSubmit = () => {
        let thisRef = this;
        let que = this.state.Question;
        let user = this.state.currentUser;
        let sessionId = this.state.sessionId;
        if (que.length !== 0) {
            firestoreDB.collection(questionTable)
            .add({
                    Question: que,
                    askedBy: user,
                    SessionId: sessionId,
                    timestamp : firebase.firestore.FieldValue.serverTimestamp(),
                    voters : [],
                    voteCount : 0
            })
            .then(function (docRef) {
                thisRef.setState({
                    Question: ""
                })
                Alert.alert("Question submitted successfully");
                thisRef.getQuestions();
            })
            .catch(function (error) {
                console.error("Error adding document: ", error);
            });
        }
        else {
            Alert.alert("Please fill the question field...");
        }
    }
    onChangeInputText = (text) => {
        let Question = text;
        this.setState({
            Question: Question
        })
    }
    displayQuestions = () =>{
        let questionList = this.state.questionData.map(question =>{
            let askedBy = question.questionSet.askedBy;
            let fullName = askedBy.firstName + " " + askedBy.lastName;
            var votesCount = question.questionSet.voteCount.toString();
            return(
                <View >
                    <RkCard style={{ marginLeft: 5, marginRight: 5, height: 125 }}>
                        <View style={{ flexDirection: 'row', marginLeft: 3, marginTop :5 }}>
                            <View style={{marginVertical :25}}>
                                <Text style={{fontStyle: 'italic',fontSize: 12}}>{fullName}</Text>
                                <View>{this.getDateTime(question.questionSet.timestamp)}</View>
                            </View>
                            <View style={{width : 150, flex: 1,flexDirection: 'column',justifyContent: 'center',marginLeft:5,marginRight:5}}>
                                <Text style={{fontSize: 14 }} >{question.questionSet.Question}</Text>
                            </View>
                            <View style={{ marginRight: 5 ,marginVertical :25}} >{this.checkLikeStatus(question)}
                               <Text style={{fontSize: 14 }}>{votesCount}</Text> 
                            </View>
                        </View>
                    </RkCard>
                </View>
            )
        })
        return questionList;
    }
    getDateTime = (queDateTime) => {
        let queDate = Moment(queDateTime).format("DD MMM,YYYY");
        let queTime = Moment(queDateTime).format("hh:mm A");
        return (
            <View>
            <Text style={{fontSize: 10 }}>{queDate}</Text>
            <Text style={{fontSize: 10 }}>{queTime}</Text>
            </View>
        );
    }
    checkLikeStatus = (question) => {
        let thisRef = this;
        let votes = question.questionSet.voteCount;
        let votersList = question.questionSet.voters;
        let voterStatus = false;
        votersList.forEach(voterId => {
            if(voterId == thisRef.state.currentUid){
                voterStatus = true;
            }
        })
        if(voterStatus == true){
            return(
                <Text style={{ fontSize: 25,width: 36,height : 36}}><Icon name="md-thumbs-up"  style={{ color : '#3872d1'}}/></Text>
            );
        }
        else{
            return(
                <Text  style={{ fontSize: 25,width: 36,height : 36}} onPress={() => this.onLikeQuestion(question)} ><Icon name="md-thumbs-up" style={{ color : '#8c8e91'}} /></Text> 
            )
        }
        
    }
    onLikeQuestion = (question) => {
        let thisRef = this;
        let questionId = question.questionId;
        let likedBy  = question.questionSet.voters;
        likedBy.push(this.state.currentUid);
        let voteCount = likedBy.length;
        Service.getDocRef(questionTable)
        .doc(questionId)
        .update({
            "voters" : likedBy,
            "voteCount" : voteCount
        })
        .then(function (dofRef){
            thisRef.getQuestions();
        })
        .catch(function(err){
            console.log("err" + err);
        })
    }
    onTopQueSelect = () => {
        let order = 'voteCount';
        if(this.state.topQueView == false){
            this.setState({
                topQueView : true,
                recentQueView : false,
                orderBy : order
            })
            this.getQuestions(order);
        }
    }

    onRecentQueSelect = () => {
        if(this.state.recentQueView == false){
            let order = 'timestamp';
            this.setState({
                topQueView : false,
                recentQueView : true,
                orderBy : order
            })
            this.getQuestions(order);
        }
    }
    render() {
        return (
            <ScrollView>
                <RkAvoidKeyboard
                onStartShouldSetResponder={(e) => true}
                onResponderRelease={(e) => Keyboard.dismiss()}>
                <View style={{flexDirection :'row'}} pointerEvents={this.state.queAccess}>
                    <RkTextInput type="text"  style={{width: 300, marginRight: 10 }}placeholder="Enter your question here..." value={this.state.Question} name="Question" onChangeText={(text) => this.onChangeInputText(text)} />
                    <TouchableOpacity onPress={() => this.onSubmit()}>
                    <RkText  style={{ fontSize: 35,width: 46,height : 46 , marginLeft : 8 }}><Icon name="md-send"/> </RkText>
                    </TouchableOpacity>
                </View>

                <View style={{ alignItems: 'center', flexDirection: 'row', width: 380, marginBottom: 3, marginLeft: 2, marginRight: 2 }}>
                    <View style={{ width: 180 }} >
                        <RkButton rkType='outline'
                            contentStyle={{ fontSize: 18 }}
                            name="Recent"
                            style={{ fontSize: 15, flexDirection: 'row', width: 170, marginLeft: 2, marginRight: 1 }}
                            onPress={this.onRecentQueSelect}
                        >Recent Questions
                             </RkButton>     
                    </View>
                    <View style={{ width: 180 }} >
                        <RkButton rkType='outline'
                            contentStyle={{ fontSize: 18 }}
                            name="Top"
                            style={{ fontSize: 15, flexDirection: 'row', width: 170, marginLeft: 1, marginRight: 2 }}
                            onPress={this.onTopQueSelect}
                        >Top Questions </RkButton>
                    </View>
                </View>
                <View>
                    <View style={styles.section}>
                        <View style={[styles.row, styles.heading]}>
                            {
                                this.state.topQueView ? <RkText style={{ fontSize: 18 }} rkType='header6 primary'>Top</RkText> : null
                            }
                        </View>
                        <View style={[styles.row, styles.heading]}>
                            {
                                this.state.recentQueView ? <RkText style={{ fontSize: 18 }} rkType='header6 primary'>Recent</RkText> : null
                            }
                        </View>
                    </View>
                    <View style={[styles.row, styles.heading]}>
                            {
                                this.state.questionStatus ? <Text style={{ fontSize: 18 }}>No Questions Found...</Text> : null
                            }
                        </View>
                    {this.displayQuestions()}
                </View>
               
            </RkAvoidKeyboard>
            </ScrollView>
        );
    }
}

let styles = RkStyleSheet.create(theme => ({
    root: {
      backgroundColor: theme.colors.screen.base
    },
    section: {
      marginVertical: 5,
      marginBottom : 4
    },
    descSection : {
      marginVertical: 25,
      marginBottom : 10,
      marginTop : 5
    },
    subSection: {
      marginTop : 5,
      marginBottom :10
    },
    row: {
      flexDirection: 'row',
      paddingHorizontal: 17.5,
      borderColor: theme.colors.border.base,
      alignItems: 'center'
    },
    text :{
      marginBottom : 5,
      fontSize : 15,
      marginLeft: 20
    },
    surveButton :{
      alignItems: 'baseline',
      flexDirection: 'row',
      width: 380,
      marginTop: 8, 
      marginBottom: 3,
      marginLeft: 5,
      marginRight: 5 
    },
    avatar: {
        backgroundColor: '#C0C0C0',
        width: 40,
        height: 40,
        borderRadius: 20,
        textAlign: 'center',
        fontSize: 20,
        textAlignVertical: 'center',
        marginRight: 5
    }
  }));
