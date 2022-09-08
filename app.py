from dataclasses import replace
from flask import Flask
from flask import render_template
from flask import request

"""Getting Started Example for Python 2.7+/3.3+"""
from boto3 import Session
from botocore.exceptions import BotoCoreError, ClientError
from contextlib import closing
import os
import sys
import subprocess
from tempfile import gettempdir

import openai
from dotenv import load_dotenv

import json

""" Libraries for Transcribe"""

import asyncio

import sounddevice

from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.handlers import TranscriptResultStream
from amazon_transcribe.model import TranscriptEvent

import threading
import requests

from flask import Flask, render_template
from flask_socketio import SocketIO,emit

""" Brain Images & Database """
import sqlite3
import re
from craiyon import Craiyon
import shutil

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

load_dotenv()
openai.organization = ""
openai.api_key = ""

# app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/page/")
def page():
    return render_template("page.html")

@app.route("/webgl/")
def webgl():
    return render_template("webgl.html")

@app.route("/mischief/")
def mischief():
    return render_template("mischief.html")

#===========================================================================
#                          Talk to Mischief
#===========================================================================
@app.route("/talk-to-mischief/")
def talk_to_mischief():
    returnObject = {}

    # Append each speech to conversation file
    def append_to_txt_file(text):
        text = text.strip()
        text = text.replace('\\n','\n')

        isConversationFileExisted = os.path.exists("./static/mp3/conversation.txt")

        if isConversationFileExisted:
            with open('./static/mp3/conversation.txt', 'a') as f:
                f.writelines('\n\n'+text)
        else:
            with open('./static/mp3/conversation.txt', 'w') as f:
                f.write(text)

    # Read conversation file
    def read_txt_file():
        conversation = ''

        isConversationFileExisted = os.path.exists("./static/mp3/conversation.txt")
        if isConversationFileExisted:
            with open('./static/mp3/conversation.txt') as f:
                conversation = f.read()
                
        return conversation

    # Step 1: get the human logos
    human_logos = request.args.get("human_logos")
    human_logos = human_logos.strip()
    human_logos = human_logos.replace('\\n','\n')
    append_to_txt_file(human_logos)
    human_logos = read_txt_file()
    human_logos = human_logos.strip()

    # Step 2: query GPT-3
    GPT3response = openai.Completion.create(
        model="text-davinci-002",
        prompt=human_logos,
        temperature=0.95,
        max_tokens=800,
        top_p=1,
        stop=["Vam:"]
    )
    
    GPT3responseText = GPT3response["choices"][0]["text"].strip().replace('Mischief:\n\n','Mischief: ',1).replace('\n\n','\n').replace('\n',' ')
    append_to_txt_file(GPT3responseText)
    returnObject["GPT3response"] = GPT3response

    # Step 3: query Amazon Polly

    def polly_speech_mark(logos):
        session = Session(profile_name="default")
        polly = session.client("polly") 

        try:
        # Request speech synthesis
            response = polly.synthesize_speech(
                Text=logos.lstrip('Mischief:').strip(), OutputFormat="json", VoiceId="Matthew", Engine = 'neural', SpeechMarkTypes=["viseme"])
        except (BotoCoreError, ClientError) as error:
            # The service returned an error, exit gracefully
            print(error)
            sys.exit(-1)
        
        if "AudioStream" in response:
        # Note: Closing the stream is important because the service throttles on the
        # number of parallel connections. Here we are using contextlib.closing to
        # ensure the close method of the stream object will be called automatically
        # at the end of the with statement's scope.
            with closing(response["AudioStream"]) as stream:
                sr = stream.read()
                output = os.path.join(os.getcwd()+"/static/mp3/", "mark.json")
                with open(output, "wb") as file:
                    file.write(sr)
                return sr
        else:
            # The response didn't contain audio data, exit gracefully
            print("Could not stream audio")
            sys.exit(-1)

    
    def polly_mp3(logos):
        session = Session(profile_name="default")
        polly = session.client("polly")

        try:
            # Request speech synthesis
            response = polly.synthesize_speech(
                Text=logos.lstrip('Mischief:').strip(), OutputFormat="mp3", VoiceId="Matthew", Engine = 'neural')
        except (BotoCoreError, ClientError) as error:
            # The service returned an error, exit gracefully
            print(error)
            sys.exit(-1)

        # Access the audio stream from the response
        if "AudioStream" in response:
            with closing(response["AudioStream"]) as stream:
                output = os.path.join(os.getcwd()+"/static/mp3/", "speech.mp3")
                try:
                    with open(output, "wb") as file:
                        file.write(stream.read())
                except IOError as error:
                    print(error)
                    sys.exit(-1)
    
    polly_mp3(GPT3responseText)
    speech_mark = polly_speech_mark(GPT3responseText)
    speech_mark = str(speech_mark).lstrip("b").lstrip("'").rstrip("'").rstrip("\\n")
    returnObject["speechMarkString"] = speech_mark

    return returnObject

@app.route("/socket-client/")
def socket_client():
    return render_template("socket_client.html")

#===========================================================================
#                            WebSockets
#===========================================================================

if __name__ == '__main__':
    socketio.run(app, debug=True)

@socketio.on('connect', namespace='/socket_conn')
def test_connect():
    socketio.emit('server_info_response', {'data': 'connected'},namespace='/socket_conn')

task = None
@socketio.on('connect_transcribe', namespace='/socket_conn')
def test_message(message):
    print(message)

    #---------------------------------------------------------------------------
    #                            Transcribe - Begin
    #---------------------------------------------------------------------------

    class MyEventHandler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, transcript_event: TranscriptEvent):
            # This handler can be implemented to handle transcriptions as needed.
            # Here's an example to get started.
            results = transcript_event.transcript.results
            print(results)
            for result in results:
                for alt in result.alternatives:
                    result_object = alt.transcript+"|"+str(result.is_partial)
                    # print(alt.transcript+"|"+str(result.is_partial))
                    socketio.emit('transcribe_text', {'data': alt.transcript+"|"+str(result.is_partial)},namespace='/socket_conn')

    async def mic_stream():
        # This function wraps the raw input stream from the microphone forwarding
        # the blocks to an asyncio.Queue.
        loop = asyncio.get_event_loop()
        input_queue = asyncio.Queue()

        def callback(indata, frame_count, time_info, status):
            loop.call_soon_threadsafe(input_queue.put_nowait, (bytes(indata), status))

        # Be sure to use the correct parameters for the audio stream that matches
        # the audio formats described for the source language you'll be using:
        # https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html
        stream = sounddevice.RawInputStream(
            channels=1,
            samplerate=16000,
            callback=callback,
            blocksize=1024 * 2,
            dtype="int16",
        )
        # Initiate the audio stream and asynchronously yield the audio chunks
        # as they become available.
        with stream:
            while True:
                indata, status = await input_queue.get()
                yield indata, status


    async def write_chunks(stream):
        # This connects the raw audio chunks generator coming from the microphone
        # and passes them along to the transcription stream.
        async for chunk, status in mic_stream():
            await stream.input_stream.send_audio_event(audio_chunk=chunk)
        await stream.input_stream.end_stream()


    async def basic_transcribe():
        # Setup up our client with our chosen AWS region
        client = TranscribeStreamingClient(region="us-west-2")

        # Start transcription to generate our async stream
        stream = await client.start_stream_transcription(
            language_code="en-US",
            media_sample_rate_hz=16000,
            media_encoding="pcm",
        )

        # Instantiate our handler and start processing events
        handler = MyEventHandler(stream.output_stream)
        await asyncio.gather(write_chunks(stream), handler.handle_events())
        
        return handler.asr_result

    def start_trans():
        asyncio.set_event_loop(asyncio.SelectorEventLoop())
        loop = asyncio.get_event_loop()
        task = loop.create_task(basic_transcribe())
        loop.run_until_complete(task)
        # loop.run_until_complete(basic_transcribe())
        loop.close()
        return task.result()

    transcribe_thread = threading.Thread(target=start_trans)
    transcribe_thread.start()
    transcribe_thread.join()

#===========================================================================
#                        Brain Image Operations
#===========================================================================
#------------------------------------------------
#  Get summary from GPT-3 and save to database
#------------------------------------------------
@app.route("/get_summary_from_gpt3/")
def get_summary_from_gpt3():
    # Get the summary list from GPT-3
    def get_summary_from_gpt3():
        conversation = '''Create a list that come from specific things appeared in the conversation below.  List content have to not include two persons names. For example:
1. A name is figured out.
2. Kung Pao Chicken, hamburger, spaghetti, roast duck are delicious food.
3. Hot pot is from Sichuan.'''

        isConversationFileExisted = os.path.exists("./static/mp3/conversation.txt")
        if isConversationFileExisted:
            with open('./static/mp3/conversation.txt') as f:
                conversation += "\n\n\""+f.read().strip()+"\""
        # Query GPT-3
        print('---------------')
        print(conversation)
        GPT3response = openai.Completion.create(
            model="text-davinci-002",
            prompt=conversation,
            temperature=0,
            max_tokens=1024,
            top_p=1
        )
        print('---------------')
        print(GPT3response)
        GPT3responseText = GPT3response["choices"][0]["text"].strip()
        return GPT3responseText
    
    summary_list = get_summary_from_gpt3()
    print(summary_list)
    summary_list = summary_list.split('\n')
    

    # Save summary list to SQLite database
    with closing(sqlite3.connect("./static/mp3/summary.db")) as connection:
        for line in summary_list:
            sentence = re.sub('^\d+\. ','',line).strip().replace("'","''")
            connection.execute("INSERT OR IGNORE INTO sentences(sentence, done) \
                VALUES('"+sentence+"',0)")
            connection.commit()
    
    return "summary list saved in database"

#------------------------------------------------
#     Create brain images from craiyon.com
#------------------------------------------------
@app.route("/create_brain_image/")
def create_brain_image():
    # Checking database, if unprocessed records exist, obtain one
    record = None
    with closing(sqlite3.connect("./static/mp3/summary.db")) as connection:
        cursor = connection.cursor()
        sql = "SELECT * FROM sentences WHERE done <> 1"
        sql_count = "SELECT count(*) FROM sentences WHERE done <> 1"
        record_count = cursor.execute(sql_count).fetchone()[0]
        if record_count > 0:
            record = cursor.execute(sql).fetchone()
        connection.commit()

    # Generate brain images and save to disk
    if record != None:
        generator = Craiyon() # Instantiates the api wrapper
        result = generator.generate(record[1])
        image_len = len(result.images)
        result.save_images('./static/brain_images/temp/')

        for x in range(1, 10):
            shutil.copyfile('./static/brain_images/temp/image-'+str(x)+'.png','./static/brain_images/selected_images/'+str(record[0])+'_'+str(x)+'.png')

        # Update Senteces table: mark one sentence to be done.
        with closing(sqlite3.connect("./static/mp3/summary.db")) as connection:
            cursor = connection.cursor()
            sql = "UPDATE sentences SET done = 1 WHERE id =" + str(record[0])
            cursor.execute(sql)

            # Insert 9 image names in to Images table
            for x in range(1, 10):
                sql = "INSERT INTO images(image_name, used) VALUES('"+str(record[0])+"_"+str(x)+".png',0)"
                print(sql)
                cursor.execute(sql)
            
            connection.commit()
    
    return 'create_brain_image done.'

#------------------------------------------------
#          Client request one image
#------------------------------------------------
@app.route("/client_get_brain_image/")
def client_get_brain_image():
    
    # Check if there is a image available
    record = None
    return_value = ''
    with closing(sqlite3.connect("./static/mp3/summary.db")) as connection:
        cursor = connection.cursor()
        sql = "SELECT * FROM images WHERE used = 0 ORDER BY RANDOM() LIMIT 1"
        sql_count = "SELECT count(id) FROM images WHERE (used = 0)"
        sql_one_more = "SELECT * FROM images ORDER BY RANDOM() LIMIT 1"
        record_count = cursor.execute(sql_count).fetchone()[0]
        print(record_count)
        if record_count > 0:
            record = cursor.execute(sql).fetchone()
            return_value = str(record[1])

            sql_update_used = "UPDATE images SET used = 1 WHERE id =" + str(record[0])
            cursor.execute(sql_update_used)
        else:
            record = cursor.execute(sql_one_more).fetchone()
            return_value = str(record[1])
        connection.commit()

    return(return_value)


@app.route("/pseudo-gpt3/")
def pseudo_gpt3():
    return render_template("pseudo_gpt3.html")