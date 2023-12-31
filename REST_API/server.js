import express from 'express'
import * as dotenv from'dotenv'
import cors from 'cors'
import bodyParser from 'body-parser';
import { Configuration, OpenAIApi } from 'openai'
import axios from "axios";
import SibApiV3Sdk from "sib-api-v3-sdk";
import fs from "fs";
import { format } from 'date-fns';
import { google } from 'googleapis';

dotenv.config();

const configuration = new Configuration({
  organization: process.env.ORG,
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const app = express()
app.use(bodyParser.json())
app.use(cors())

//Get user queries on port 5000, send queries to chatGPT, get response and send it back to user.
app.post('/', async (req, res) => {
  try {
    const { messages } = req.body; //Get user query
    console.log(messages[messages.length - 1]);
    //initialize bot variables
    const msgs = [{role: "system", content: "You are a helpful chatbot assistant for an e-commerce website that sells fragrance balms. If you are unable to answer a prompt, ask the customer to contact dabalmdotcom@gmail.com"},...messages];
    const functions = [
      {
        name: "getProductInfo",
        description: "Get relevant product information for all products such as product descriptions or product titles.",
        parameters: {
          type: "object",
          properties: {
            xfactor: {
              type: "string",
              description: 'The type of data required. E.g. "title" or "description"'
            }
          },
          required: ["xfactor"],
        }
      },
      {
        name: "getOrderInfo",
        description: "Get tracking link for a customer order using their order id and zip/postal code.",
        parameters: {
          type: "object",
          properties: {
            orderID: {
              type: "string",
              description: 'The order ID. E.g. "1234". Remove "#" if provided.'
            },
            zip: {
              type: "string",
              description: 'The customer zip or postal code for their shipping address. Must be entered without spaces.'
            }
          },
          required: ["orderID", "zip"],
        }
      },
      {
        name: "getWeather",
        description: "Gets the weather condition and location in the requester's local area.",
        parameters: {
          type: "object",
          properties: {
            weatherType: {
              type: "string",
              description: 'Type of weather data required e.g. "current"'
            }
          },
          required: ["weatherType"],
        }
      },
      {
        name: "addSubscriber",
        description: "Adds user as an email subscriber of emailing list.",
        parameters: {
          type: "object",
          properties: {
            fname: {
              type: "string",
              description: 'First name of user'
            },
            lname: {
              type: "string",
              description: 'Last name of user'
            },
            email: {
              type: "string",
              description: 'Email address of user'
            }
          },
          required: ["fname", "lname", "email"],
        }
      }
    ];
    //Send user query to chatGPT and wait for response
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages: msgs,
      functions: functions,
      function_call: "auto",
    });
    //Store chatGPT's response
    const completionResponse = completion.data.choices[0].message;
    
    if(!completionResponse.content) //If user query requires calling a function
    {
      const functionCallName = completionResponse.function_call.name; //Then get function name

      if(functionCallName === "getProductInfo") //If function is getProductInfo
      { 
        const completionArguments = JSON.parse(completionResponse.function_call.arguments); //get function arguments from GPT

        try 
        {
          const productInfo = await getProductInfo(completionArguments.xfactor); //Call the function with given arguments
          //console.log(completionArguments.xfactor);
          msgs.push(completionResponse); //Add intitial response to message history
          msgs.push({ role: 'function', name: functionCallName, content: `${productInfo}` }); //add function results to message history
        } 
        catch (error) { console.error(error);}
      }   

      if(functionCallName === "getOrderInfo") //If function is getOrderInfo
      { 
        const completionArguments = JSON.parse(completionResponse.function_call.arguments);
        
        try {
          const orderInfo = await getOrderInfo(completionArguments.orderID, completionArguments.zip);
          console.log(completionArguments.orderID);
          msgs.push(completionResponse);
          msgs.push({ role: 'function', name: functionCallName, content: `${orderInfo}` });
        } 
        catch (error) { console.error(error);}
      }

      if(functionCallName === "getWeather") //If function is getWeather
      { 
        //const completionArguments = JSON.parse(completionResponse.function_call.arguments);
        try {
          const weather = await getWeather(req.body.POSTAL);
          console.log("POSTAL: ", req.body.POSTAL);
          console.log("Weather: ", weather);
          msgs.push(completionResponse);
          msgs.push({ role: 'function', name: functionCallName, content: `${weather}` });
        } 
        catch (error) { console.error(error);}
      }

      if(functionCallName === "addSubscriber") //If function is addSubscriber
      { 
        const completionArguments = JSON.parse(completionResponse.function_call.arguments);
        
        try {
          const subscriberInfo = addSubscriber(completionArguments.fname, completionArguments.lname, completionArguments.email);
          msgs.push(completionResponse);
          msgs.push({ role: 'function', name: functionCallName, content: `${subscriberInfo}` });
        } 
        catch (error) { console.error(error);}
      }
      //Send function results to chatGPT and await final response
      const second_response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo-0613",
        messages: msgs,
      });
      //Get final response from chatGPT and send it to user
      res.json({
        completion: second_response.data.choices[0].message
      });

    }
    //Else function call is not required
    else
    {
      res.json({
        completion: completionResponse //send user the initial response from chatGPT
      });
    }
  } 
  catch (error) {
    console.error(error)
    res.status(500).send(error || 'Something went wrong');
  }

})

//Listen for user queries on port 5000
app.listen(5000, () => console.log('AI server started on http://localhost:5000'));

//------------------------------------FUNCTIONS------------------------------------------//
let shopifyKey = process.env.SHOPIFY_API_KEY;
let pass = process.env.PASSWORD;

//Get product information from Shopify
async function getProductInfo(xfactor) 
{
  let endPoint = "products";
  try {
    let options = {
      "method": "GET",
      "url": `https://${shopifyKey}:${pass}@dabalmdotcom-8456.myshopify.com/admin/api/2023-07/${endPoint}.json`,
      "headers":  {
          "Content-Type": "application/json"
      }
  };

    const response = await axios(options);
    const data = response.data;
    //console.log(data);
    const obj = result(data);
    //console.log(obj);
    return obj;
  } catch (error) {
    console.error(error);
    return null;
  }
}

//Parse product information and return relevant details
function result(data) 
{
  const finddata = [];
  const regex = /<([^>]+)>/g;
  for (const item in data['products']) 
  {
    if(data['products'][item].status === "active")
    {
      finddata.push("[TITLE: " + data['products'][item].title + "\n" +
                    "DESCRIPTION: " + data['products'][item].body_html.replace(regex, "") + "\n" +
                    "PRODUCT_URL: " + "https://dabalmdotcom.com/products/" + data['products'][item].handle + "]\n"
                    );
    }
  }
  return finddata.toString();
}

//Get order information from Shopify
async function getOrderInfo(orderID, zip) 
{
  let endPoint = "orders";
  try {
    let options = {
      "method": "GET",
      "url": `https://${shopifyKey}:${pass}@dabalmdotcom-8456.myshopify.com/admin/api/2022-04/${endPoint}.json?name=%23${orderID}&status=any`,
      "headers":  {
          "Content-Type": "application/json"
      }
  };
    const response = await axios(options);
    const data = response.data;
    let stats = "awaiting shipment";
    //console.log("data: ", data["orders"][0]);
    if(data["orders"][0].fulfillment_status != null){
      stats = data["orders"][0].fulfillments[data["orders"][0].fulfillments.length - 1].shipment_status;
      //console.log("stats ", stats);
    }
    const tracking = data["orders"][0].order_status_url.toString();
    const orderInfo = "Tracking URL: " + tracking + "\n" + "Current Status: " + stats + "\n";
    let ActualZip = data["orders"][0].shipping_address.zip.toString();
    
    ActualZip = ActualZip.toLowerCase().replace(/\s/g, "");
    zip = zip.toLowerCase();
    //console.log("zip: ", zip);
    //console.log("ActualZip: ", ActualZip);

    if(ActualZip === zip){
      //console.log(orderInfo);
      return orderInfo;
    }else{
      console.log("Incorrect zip/postal code");
      return "Incorrect zip/postal code";
    }
       
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getWeather(ip) {
  try {
    const options = {
      method: 'GET',
      url: `http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${ip}`,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const response = await axios(options);
    const data = response.data;

    const condition = "location: " + data.location.name.toString() + ", weather: " + data.current.condition.text.toString();
    console.log(condition);
    return condition;

  } catch (error) {
    console.error(error);
    return null;
  }
}

function addSubscriber(fname, lname, email){
  let defaultClient = SibApiV3Sdk.ApiClient.instance;
  let brevoKey = defaultClient.authentications['api-key'];
  brevoKey.apiKey = process.env.BREVO_API_KEY;
  let apiInstance = new SibApiV3Sdk.ContactsApi();
  let createContact = new SibApiV3Sdk.CreateContact();
  
  createContact.email = email;
  createContact.attributes = {"FIRSTNAME":fname,"LASTNAME":lname};
  createContact.listIds = [4]
  
  apiInstance.createContact(createContact).then(function(data) {
    console.log('API called successfully. Returned data: ' + JSON.stringify(data));
    return('API called successfully. Returned data: ' + JSON.stringify(data));
  }, function(error) {
    console.error(error);
    return error;
  });
}
/*
const credentials = {
    installed: {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uris: ['https://project-codex.onrender.com']
    }
};

const token = {
    access_token: 'YOUR_ACCESS_TOKEN',
    refresh_token: 'YOUR_REFRESH_TOKEN',
    scope: 'https://www.googleapis.com/auth/documents',
    token_type: 'Bearer',
};

authorize(credentials, appendToDoc);

function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    oAuth2Client.setCredentials(token);
    callback(oAuth2Client);
}

function appendToDoc(auth) {
    const docs = google.docs({version: 'v1', auth});
    const documentId = '1PNfFFTt8PvjKBH4S_QvpEszekPFiyqgHXb7SzoNFEoI';  // Replace with your Google Docs document ID

    const requests = [
        {
            insertText: {
                location: {
                    index: 1,
                },
                text: "\nThis is the appended text."
            }
        }
    ];

    docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
            requests: requests
        }
    }, (err, res) => {
        if (err) return console.log('The API returned an error:', err);
        console.log('Text appended successfully!');
    });
}
*/