const chatbotToggler = document.querySelector(".chatbot-toggler");
const closeBtn = document.querySelector(".close-btn");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span");

let userMessage = "Use current weather and location data say precisely the following: Hi there 👋 [make a new line] it looks like a [based on current weather say either: cloudy/rainy/sunny/snowy/windy/foggy] day in [location]. How can I help you today? If you can't get the weather data simply say: Hi there 👋 [make a new line] How can I help you today?"; // Variable to store user's message
let messages = [];
const inputInitHeight = chatInput.scrollHeight;

let postal;
$.get("https://ipgeolocation.abstractapi.com/v1/?api_key=992fa49af19647158f3e6f8526bfe06b", function (response) {
postal = response.postal_code;
console.log("THIS IS THE POSTAL", response.postal_code);
}, "json");

const createChatLi = (message, className) => {
    // Create a chat <li> element with passed message and className
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", `${className}`);
    let chatContent = className === "outgoing" ? `<p></p>` : `<span class="material-symbols-outlined">smart_toy</span><p></p>`;
    chatLi.innerHTML = chatContent;
    chatLi.querySelector("p").textContent = message;
    return chatLi; // return chat <li> element
}

const generateResponse = (chatElement) => {
    const API_URL = "https://project-codex.onrender.com";
    const messageElement = chatElement.querySelector("p");
    const newMessage = {"role": "user", "content": `${userMessage}`};
    messages.push(newMessage);

    // Define the properties and message for the API request
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messages,
            "POSTAL": postal
        })
    }

    // Send POST request to API, get response and set the reponse as paragraph text
    fetch(API_URL, requestOptions).then(res => res.json()).then(data => {
        messages.push({"role": "assistant", "content": `${data.completion.content.trim()}`});
        messageElement.textContent = data.completion.content.trim();
        
        var currentText = messageElement.innerHTML;
        // Regular expression to match a URL
        var urlRegex = /\((https?:\/\/[^\s/$.?#].[^\s]*)\)/g;
        const emailRegex = /dabalmdotcom@gmail\.com\b/gi;

        // Check if the current text contains a URL
        if (urlRegex.test(currentText)) {
            var newText = currentText.replace(urlRegex, function(match, url) {
                return `<a href="${url}" target="_blank">here</a>`;
              });            
            var trackOrderRegex = /\[(.*?)\]/g;
            newText = newText.replace(trackOrderRegex, '');
            // Update the content of the <p> element
            messageElement.innerHTML = newText;
            currentText = messageElement.innerHTML;
        }
        if(emailRegex.test(currentText)){
            var newText = currentText.replace(emailRegex, '<a href="mailto:dabalmdotcom@gmail.com" style="text-decoration: underline;">$&</a>');
            console.log(newText);
            messageElement.innerHTML = newText;
        }

    }).catch(() => {
        messageElement.classList.add("error");
        messageElement.textContent = "Oops! Something went wrong. Please try again.";
    }).finally(() => chatbox.scrollTo(0, chatbox.scrollHeight));
}

const handleChat = () => {
    userMessage = chatInput.value.trim(); // Get user entered message and remove extra whitespace
    if(!userMessage) return;

    // Clear the input textarea and set its height to default
    chatInput.value = "";
    chatInput.style.height = `${inputInitHeight}px`;

    // Append the user's message to the chatbox
    chatbox.appendChild(createChatLi(userMessage, "outgoing"));
    chatbox.scrollTo(0, chatbox.scrollHeight);
    
    setTimeout(() => {
        // Display "Thinking..." message while waiting for the response
        const incomingChatLi = createChatLi("Thinking...", "incoming");
        chatbox.appendChild(incomingChatLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);
        generateResponse(incomingChatLi);
    }, 600);
}

function intializeChat(){
    setTimeout(() => {
        // Display "Thinking..." message while waiting for the response
        const incomingChatLi = createChatLi("Thinking...", "incoming");
        chatbox.appendChild(incomingChatLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);
        generateResponse(incomingChatLi);
    }, 600);
}

intializeChat();

chatInput.addEventListener("input", () => {
    // Adjust the height of the input textarea based on its content
    chatInput.style.height = `${inputInitHeight}px`;
    chatInput.style.height = `${chatInput.scrollHeight}px`;
});

chatInput.addEventListener("keydown", (e) => {
    // If Enter key is pressed without Shift key and the window 
    // width is greater than 800px, handle the chat
    if(e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
        e.preventDefault();
        handleChat();
    }
});

sendChatBtn.addEventListener("click", handleChat);
closeBtn.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));