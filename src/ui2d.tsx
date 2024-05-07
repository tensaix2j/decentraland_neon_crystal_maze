
import { 
    ReactEcsRenderer,
    ReactEcs, 
    UiEntity, 
    Label, 
    Input, 
    DisplayType
} from '@dcl/sdk/react-ecs'



import { 
    engine 
} from '@dcl/sdk/ecs'

import { Color4 } from '@dcl/sdk/math'
import resources from "./resources";



export class UI2D {

    //---------------
    constructor() {
        
        resources["ui"] = {};
        resources["ui"]["bgmask"] = {};
        resources["ui"]["bgmask"].visible = "none";

        resources["ui"]["inventory"] = {};
        resources["ui"]["inventory"].visible = "flex";
        resources["ui"]["inventory"]["items"] = [];

        resources["ui"]["hint"] = {};
        resources["ui"]["hint"].visible = "none";
        resources["ui"]["hint"].text = "";
        

        for ( let i = 0 ; i < 8 ; i++ ) {
            resources["ui"]["inventory"]["items"][i] = {}
            resources["ui"]["inventory"]["items"][i].visible = "none";
            resources["ui"]["inventory"]["items"][i].count_lbl   = "";
            resources["ui"]["inventory"]["items"][i].count      = 0;
            
        }
        
        resources["ui"]["notification"] = {};
        resources["ui"]["notification"].text = "";
        resources["ui"]["notification"].visible = "flex";

        resources["ui"]["gamestatus"] = {};
        resources["ui"]["gamestatus"].chip_remaining = 0;

        ReactEcsRenderer.setUiRenderer( this.UI_JSX );
        engine.addSystem( this.update );
    }


    //------------
    update() {

    }


    //---------
    static UI_bgmask(props: {} ) {
        return <UiEntity
            uiTransform={{
                width: 4000,
                height: 4000,
                positionType: 'absolute',
                display: resources["ui"]["bgmask" ].visible ,
            }}
            uiBackground={{
                color: Color4.create( 0,0,0, 0.95 )
            }}
        ></UiEntity>
    }

    //---------
    static UI_notificationComponent(props: {} ) {
        return <UiEntity
            uiTransform={{
                display: resources["ui"]["notification"].visible ,
            }}
            uiText={{ 
                value: resources["ui"]["notification"].text, 
                fontSize: 40 ,
                textAlign: 'middle-center',
                color: Color4.Yellow()
        
            }}
        ></UiEntity>
    }


    //----------------------
    static UI_inventory_item( props: { id:number; frame_x:number; frame_y:number; top:number; left:number;  } ) {

        return <UiEntity
            uiTransform={{
                width: 120,
                height: 120,
                positionType: 'absolute',
                position: {
                    top: props.top,
                    left: props.left
                },   
                display: resources["ui"]["inventory" ]["items"][props.id].visible ,
            }}
            uiBackground={{
                textureMode: 'stretch',
                texture: {
                    src: 'images/tileset_64.png',
                },
                uvs:[
                    props.frame_x / 16		    ,	 props.frame_y/ 16,
                    props.frame_x / 16		    ,	(props.frame_y+1)/ 16,
                    (props.frame_x + 1)/ 16     ,   (props.frame_y+1)/ 16,
                    (props.frame_x + 1)/ 16     ,    props.frame_y/ 16,
                ]
            }}
        >
            <UiEntity
                uiTransform={{
                    positionType: 'absolute',
                    position: {
                        top: 0,
                        right: 30
                    },
                }}
                uiText={{ 
                    value: resources["ui"]["inventory"]["items"][props.id].count_lbl, 
                    fontSize: 30 ,
                    textAlign: 'top-left',
                    color: Color4.White()
                }}
            ></UiEntity>
        </UiEntity>
    }

    //---------
    static UI_inventory(props: {} ) {
        return <UiEntity
            uiTransform={{
                width: 512,
                height: 256,
                positionType: 'absolute',
                display: resources["ui"]["inventory" ].visible ,
                position: {
                    bottom: 20,
                    right: 20
                },   

            }}
            uiBackground={{
                textureMode: 'stretch',
                texture: {
                    src: "images/inventory.png",
                }
            }}
        >
            <UI2D.UI_inventory_item id={0} frame_x={3} frame_y={15} top={4} left={4} />
            <UI2D.UI_inventory_item id={1} frame_x={4} frame_y={15} top={4} left={4+128} />
            <UI2D.UI_inventory_item id={2} frame_x={5} frame_y={15} top={4} left={4+128*2} />
            <UI2D.UI_inventory_item id={3} frame_x={6} frame_y={15} top={4} left={4+128*3} />
            <UI2D.UI_inventory_item id={4} frame_x={7} frame_y={15} top={4+128} left={4} />
            <UI2D.UI_inventory_item id={5} frame_x={8} frame_y={15} top={4+128} left={4+128} />
            <UI2D.UI_inventory_item id={6} frame_x={9} frame_y={15} top={4+128} left={4+128*2} />
            <UI2D.UI_inventory_item id={7} frame_x={10} frame_y={15} top={4+128} left={4+128*3} />
            
        </UiEntity>
    }


    //----
    static UI_gamestatus() {
        return <UiEntity
            uiTransform={{
                positionType: 'absolute',
                position: {
                    bottom: 40,
                },   
            }}
            uiText={{ 
                value: "Crystals Remaining: " + resources["ui"]["gamestatus"].chip_remaining, 
                fontSize: 40 ,
                textAlign: 'middle-center',
                color: Color4.White()
        
            }}
        ></UiEntity>
    }

    //------
    static UI_instructions() {

        return <UiEntity
        
            uiTransform={{
                width: 374,
                height: 400,
                positionType: 'absolute',
                position: {
                    left: 16,
                    top: 480
                },   
            }}
            uiBackground={{
                textureMode: 'nine-slices',
                texture: {
                    src: 'images/panel.png'
                },
                textureSlices: {
                    top: 0.2,
                    bottom: 0.2,
                    left: 0.2,
                    right: 0.2
                },
                color: Color4.fromInts( 0,0,0, 220)

            }}
        >
            <UiEntity
                uiTransform={{
                    positionType: 'absolute',
                    position: {
                        left: 10,
                        top: 10
                    },   
                }}
                uiText={{ 
                    value: "W,A,S,D to move.\n\
(Face North for correct direction) \n\n\
Collect all crystals to unlock crystal\ndoor.\n\
Reach Exit Door to complete \nlevel.\n\n\
New puzzle objects maybe\nintroduced on new levels, step on \nthe hint(Question Mark tile) \nto learn about them.\n\n\
Press [1] to restart level\n\
Press [2] to reset camera angle\n\
\n\
                    ", 
                    fontSize: 20 ,
                    textAlign: 'top-left',
                    color: Color4.White()
            
                }}
            ></UiEntity>
        </UiEntity>
    }


     //----
     static UI_hint() {

        return <UiEntity
            uiTransform={{
                width: 1600,
                height: 200,
                positionType: 'absolute',
                position: {
                    bottom: 400
                },   
                display: resources["ui"]["hint" ].visible 
            }}

            uiBackground={{
                textureMode: 'nine-slices',
                texture: {
                    src: 'images/panel2.png'
                },
                textureSlices: {
                    top: 0.2,
                    bottom: 0.2,
                    left: 0.2,
                    right: 0.2
                },
                color: Color4.fromInts(255,220,255,255)
            }}
        >
            <UiEntity
                uiTransform={{
                    positionType: 'absolute',
                    position: {
                        left: 20,
                        top: 20
                    },   
                }}
                uiText={{ 
                    value: resources["ui"]["hint"].text, 
                    fontSize: 35 ,
                    textAlign: 'top-left',
                    color: Color4.White()
            
                }}
            ></UiEntity>
        </UiEntity>
    }


    //------------
    UI_JSX() {
        return <UiEntity
            
            uiTransform={{
                justifyContent:'center',
                alignItems:'center',
                alignSelf:'center',
                width: '100%',
                height:'100%',
                
            }}
        >
            
            <UI2D.UI_bgmask />
            <UI2D.UI_inventory />
            <UI2D.UI_gamestatus />
            <UI2D.UI_instructions />
            <UI2D.UI_hint />
            <UI2D.UI_notificationComponent />

        </UiEntity>
    }
}



