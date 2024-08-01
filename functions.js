var x = document.getElementById("demo");
var y = document.getElementById("testOutput");

let sliderValue = 12;

function updateValue(value) {
    sliderValue = value;
    document.getElementById('sliderValue').textContent = value;
    console.log("changed zoom to: "+ value)
}

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(showPosition);
  } else {
    x.innerHTML = "Geolocation is not supported by this browser.";
  }
}



function main() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(navigate);
  } else {
    x.innerHTML = "Geolocation is not supported by this browser.";
  }
}






function navionics(lat,lon){


  window.location.href = "https://webapp.navionics.com/#boating@"+sliderValue+"&key=" + encrypt(lat) + encrypt(lon)

}
  






function navigate(position){
  let lat = position.coords.latitude
  let lon = position.coords.longitude
  navionics(lat,lon)
  
}


function test() {
  let lat = document.getElementById('myLat').value;
  let lon = document.getElementById('myLon').value;
  navionics(lat,lon)
  
}

function sukosan() {
  navionics(44.05159726430251, 15.301683811495284)
}

function sardinie() {
  navionics(39.209395765650456, 9.111347331120944)
}

function zweden() {
  navionics(49.32289394622535, -71.3141912034162)
}

function showPosition(position) {
  let lat = position.coords.latitude
  let lon = position.coords.longitude


  x.innerHTML = "Latitude:   " + position.coords.latitude +
            "<br>Longitude:  " + position.coords.longitude 
  
}


function encrypt(coord){
    let a = 6250
    let b = -32768
    let locbeta= coord*a+b

    const ord_l = '_ a c e g i k m o q s u w y %7B %7D'.split(' ');
    const ord_m = '_ %60 a b c d e f g h i j k l m n o p q r s t u v w x y z %7B %7C %7D ~'.split(' ');
    const ord_h = '%40 A B C D E F G H I J K L M N O P Q R S T U V W X Y Z %5B %5C %5D %5E'.split(' ');

    let loc_work = locbeta;
    let key = '';
    const base = [32768, 1024, 32, 1, 0.0625];

    let keypart_value = loc_work / base[0];

    if (keypart_value>0){
      key = ord_h[Math.floor(keypart_value)] + key;
      loc_work = loc_work% base[0];
    } else {
      
      loc_work = loc_work+base[0];
    }
   
  
  
    for (let i = 0; i < 3; i++) {

        keypart_value = loc_work / base[1 + i];
        if (keypart_value>0){
          key = ord_m[Math.floor(keypart_value)] + key;
          loc_work = loc_work% base[1+i];
        } else {
          
          loc_work = loc_work+base[1+i];
        }
        }
    
    if (keypart_value>0){
      keypart_value = loc_work / base[4];
      key = ord_l[Math.floor(keypart_value)] + key;
    } else {
      loc_work = loc_work+base[4]
    }
    
    return key
}


function showPopup() {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('loadingPopup').style.display = 'block';
}

function hidePopup() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('loadingPopup').style.display = 'none';
}

function redirectToNewPage() {
    showPopup();
    setTimeout(function() {
        window.location.href = "https://youtube.com";
    }, 2000); // Delay for 2 seconds before redirecting (for demonstration purposes)
}
