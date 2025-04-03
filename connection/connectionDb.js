const mongoose = require("mongoose");

const ConnectDb = async (DATABASE_URL)=>{

    console.log("DATABASE_URL",DATABASE_URL);
   
    try{
        
        const DB_OPTION = {
            dbName : "billionforms"
                }
            await mongoose.connect(DATABASE_URL, DB_OPTION )  ;
            
            console.log("mongoose connected successfully...");
    }

    catch(error){
    console.log(error);
    }

}

module.exports = ConnectDb;
