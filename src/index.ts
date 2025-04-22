

import { 
    Vector3,
    Quaternion,
    Color3,
    Color4 } from "@dcl/sdk/math";


import {
    engine,
    Transform,
    GltfContainer,
    AvatarShape,
    inputSystem,
    PointerEvents,
    InputAction,
    PointerEventType,
    Material,
    MeshRenderer,
    MeshCollider,
    AvatarModifierArea,
    AvatarModifierType,
    CameraModeArea,
    CameraType,
    AudioSource
} from '@dcl/sdk/ecs'

import { getUserData } from '~system/UserIdentity'
import { movePlayerTo } from '~system/RestrictedActions'
import { getRealm } from '~system/Runtime'


import { Utils } from "./utils"

import resources from "./resources";
import { Stage } from "./stage";
import { UI2D  } from "./ui2d";

//-------------------
class Index {

    public scene_parcels = Vector3.create(4,4,4);
    public camerabox;
    
    
    //--------------
    constructor() {

        resources["index"]  = this;
        resources["ui2d"]    = new UI2D();
        resources["stage"]  = new Stage( {x: 32 , y: 1 ,z:32} );
        resources["button_states"] = {};        
        
        
        let citytile_entity = engine.addEntity()
        Transform.create( citytile_entity, { 
            position: { 
                x: this.scene_parcels.x * 8, 
                y: 0.0, 
                z: this.scene_parcels.z * 8 
            },
            scale: {
                x: this.scene_parcels.x * 16 ,
                y: 1.0,
                z: this.scene_parcels.z * 16 
            }
        })
        MeshRenderer.setBox(citytile_entity);
        Material.setBasicMaterial(citytile_entity, {
            diffuseColor: Color4.fromInts(0,0,0,255),
        })
        
        
        let skydome = engine.addEntity();
        Transform.create( skydome, {
            position: { 
                x: this.scene_parcels.x * 8,
                y: 0.0,
                z: this.scene_parcels.z * 8
            },
            scale: {
                x: this.scene_parcels.x *16,
                y: this.scene_parcels.y *16,
                z: this.scene_parcels.z *16 
            }
        })
        GltfContainer.create(skydome, {
            src: 'models/skydome.glb',
        })



        this.init_async();
        this.createCameraBox();
        this.createModifierArea();
        this.init_sounds();
        

        

        engine.addSystem( this.update );
        
    }



    

    //----
    async init_async() {
        await this.init_userData();
        await this.register_visitors();
    }



    //--------------
    async init_userData() {

        
        if ( resources["userData"] == null ) {
        
            const userData = await getUserData({})
            console.log( "Check", userData.data ); 
            resources["userData"] = userData.data;
        }
        if ( resources["realm"] == null ) {
            resources["realm"] = await getRealm({});
            resources["reqrealm"] = resources["realm"].realmInfo.baseUrl;
        }

        console.log("init_userData", resources["userData"], resources["reqrealm"]);
        
    }


    //-----------
    lookAt(entity, target) {

        let src_transform       = Transform.getMutable( entity );
        let target_transform    = Transform.getMutable( target )
        const difference = Vector3.subtract(target_transform.position, src_transform.position)
        const normalizedDifference = Vector3.normalize(difference)
        src_transform.rotation.y = Quaternion.lookRotation( normalizedDifference ).y
        src_transform.rotation.w = Quaternion.lookRotation( normalizedDifference ).w

        
    }


    //---------------
    init_sounds( ) {
    	
        resources["sounds"] = {};

    	let soundfiles = [
            "correct",
            "denied",
            "success",
            "teleport",
            "switch",
            "water",
            "fire",
            "explosion",
            "scream",
            "punch",
            "hit",
            "buttonclick",
            "oof",
            "stone",
            "crystal",
            "victory",
            "buttonshort"
        ];

        for ( let i = 0 ; i < soundfiles.length ; i++ ) {
            
            let snd_ent = engine.addEntity()
            AudioSource.create(snd_ent, {
                audioClipUrl: 'sounds/' + soundfiles[i] + '.mp3',
                playing: false,
                loop: false,
                volume: 1
            })
            Transform.create( snd_ent, {
                position:Vector3.create(0,0,0) 
            });
            resources["sounds"][ soundfiles[i] ] = snd_ent;
        }

    }

    //---------
    play_sound( soundname ) {
        
        Transform.getMutable( resources["sounds"][soundname] ).position =  Transform.get(engine.PlayerEntity).position;
        AudioSource.getMutable( resources["sounds"][soundname] ).playing = true;

    }


    //---
    createModifierArea() {

        const ent = engine.addEntity()
        
        AvatarModifierArea.create(ent, {
            area: Vector3.create( this.scene_parcels.x * 16,  this.scene_parcels.y * 16,  this.scene_parcels.z * 16),
            modifiers: [AvatarModifierType.AMT_DISABLE_PASSPORTS, AvatarModifierType.AMT_HIDE_AVATARS],
            excludeIds: []
        })
        

        CameraModeArea.create(ent, {
            area: Vector3.create( this.scene_parcels.x * 16,  this.scene_parcels.y * 16,  this.scene_parcels.z * 16),
            mode: CameraType.CT_FIRST_PERSON,
        })

        Transform.create(ent, {
            position: Vector3.create(32, 0, 32),
        })

    }

    //-------
    createCameraBoxPart( ent_parent , position, scale ) {

        let ent = engine.addEntity() ;
        Transform.create( ent, {
            parent: ent_parent,
            position: position,
            scale: scale            
        });
        MeshCollider.setBox(ent);
        
        
        MeshRenderer.setBox(ent);
        Material.setPbrMaterial(ent, {
            albedoColor: Color4.fromInts(255,255,255,0),
            metallic: 0,
            roughness: 0,
        })
        
        
        return ent;
    }



  

    //-----
    async register_visitors( ) {
        
        let server_host = "https://myvercel-puce.vercel.app/api"; 
		let url = server_host + "/insert_visitor";
        
        let body = {
			useraddr	 : resources["userData"].userId.toLowerCase(),
			username     : resources["userData"].displayName,
            scene_id     : 1000,
            signature 	: Utils.sha256( resources["userData"].userId.toLowerCase() + resources["reqrealm"]  ),     
            realm     : resources["reqrealm"]      
		}
        
		let fetchopt = {
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify(body),
			method: 'POST'
		};
		let _this = this;
		try {
			let resp = await fetch(url, fetchopt ).then(response => response.text())
			console.log("sent request to URL", url , "SUCCESS", resp );
            
		} catch(err) {
			console.log("error to do", url, fetchopt, err );
		}
	}


    //---------------
	async submit_highscore( score , game_id ) {
	
		
        let server_host = "https://myvercel-puce.vercel.app/api"; 
		let url = server_host + "/insert_highscore";

        
		let body = {
			username	: resources["userData"].displayName,
			useraddr	: resources["userData"].userId.toLowerCase(),
			score   	: score,
			game_id 	: game_id,
			game    	: "cmaze",
			signature 	: Utils.sha256( resources["userData"].userId.toLowerCase() + resources["reqrealm"]  + score ),
            realm     : resources["reqrealm"]     
		}
		 
		let fetchopt = {
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify(body),
			method: 'POST'
		};
		let _this = this;
		try {
			let resp = await fetch(url, fetchopt ).then(response => response.text())
			console.log("sent request to URL", url , "SUCCESS", resp );
            
		} catch(err) {
			console.log("error to do", url, fetchopt, err );
		}
	}



    //-----------
    createCameraBox() {
        
        let camera_root = engine.addEntity();
        Transform.create( camera_root, {
            position: {
                x: 32,
                y: 8,
                z: 29 
            },
        });

        this.camerabox = camera_root;

        this.createCameraBoxPart( camera_root ,  { x: 0 , y: 0 , z: 0 },{ x: 4, y: 0.1, z: 4 });
        
        this.createCameraBoxPart( camera_root ,  { x: -0.5 , y: 1 , z: 0 },{ x: 0.2, y: 2, z: 2 });
        this.createCameraBoxPart( camera_root ,  { x:  0.5 , y: 1 , z: 0 },{ x: 0.2, y: 2, z: 2 });
        this.createCameraBoxPart( camera_root ,  { x:  0 , y: 1 , z: 0.5 },{ x: 2, y: 2, z: 0.2 });
        this.createCameraBoxPart( camera_root ,  { x:  0 , y: 1 , z: -0.5 },{ x: 2, y: 2, z: 0.2 });
        this.createCameraBoxPart( camera_root ,  { x:  0 , y: 1.35 , z: 0 },{ x: 2, y: 0.1, z: 2 });
        
    }

    //-----
    // Make sure player stays in the box
    fix_player_position() {

        let camera_root_transform = Transform.getMutable( resources["index"].camerabox );
        if ( Vector3.distanceSquared( Transform.get(engine.PlayerEntity).position , camera_root_transform.position ) > 2 ) {
            console.log("fix_player_position");
            this.resetCameraPosition();
        } 
        
    }



    //----
    fix_camerabox_position2() {

        let camera_box_transform = Transform.getMutable( resources["index"].camerabox );
        let player_transform = Transform.getMutable( resources["stage"].player );
        let stage_root_transform  = Transform.getMutable( resources["stage"].root );


        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;
        let x_offset = 0;
        let z_offset = 3;
        
        if ( yaw >= -45 && yaw <= 45 ) {
            
            x_offset = 0;
            z_offset = 3;
                
        } else if ( yaw >= -135 && yaw <= -45 ) {
            
            x_offset = -3;
            z_offset = 0;
        
        } else if ( yaw < -135 || yaw > 135 ) {
            
            x_offset = 0;
            z_offset = -3;
        
        } else if ( yaw >= 45 && yaw <= 135 ) {

            x_offset = 3;
            z_offset = 0;
        }
        
        let target_position = Vector3.create(   
            player_transform.position.x     + stage_root_transform.position.x - x_offset,
            camera_box_transform.position.y  ,
            player_transform.position.z     + stage_root_transform.position.z - z_offset ,
        );
        
    
        // immediate
        //camera_box_transform.position.x = target_position.x; 
        //camera_box_transform.position.y = target_position.y; 
        //camera_box_transform.position.z  = target_position.z; 

        if ( Vector3.distanceSquared( 
            camera_box_transform.position , 
            target_position ) > 3
        ) {
            camera_box_transform.position = Vector3.lerp( 
                camera_box_transform.position,
                target_position,
                0.03
            );
        } 
    
       
        
    }
    //------
    fix_camerabox_position() {
        
        let camera_box_transform = Transform.getMutable( resources["index"].camerabox );
        let player_transform = Transform.getMutable( resources["stage"].player );
        let stage_root_transform  = Transform.getMutable( resources["stage"].root );

        let target_position = Vector3.create(   
            player_transform.position.x     + stage_root_transform.position.x,
            camera_box_transform.position.y  ,
            player_transform.position.z - 3 + stage_root_transform.position.z ,
        );

        if ( Vector3.distanceSquared( 
            camera_box_transform.position , 
            target_position ) > 2
        ) {
            
            camera_box_transform.position = Vector3.lerp( 
                camera_box_transform.position,
                target_position,
                0.025
            );
            
     
        }
    }

    //-------------
    fix_camerabox_position_instant() {
        
        let camera_box_transform = Transform.getMutable( resources["index"].camerabox );
        let player_transform = Transform.getMutable( resources["stage"].player );
        let stage_root_transform  = Transform.getMutable( resources["stage"].root );

        let target_position = Vector3.create(   
            player_transform.position.x     + stage_root_transform.position.x,
            camera_box_transform.position.y  ,
            player_transform.position.z     + stage_root_transform.position.z - 4,
        );
        
        camera_box_transform.position.x = target_position.x; 
        camera_box_transform.position.y = target_position.y; 
        camera_box_transform.position.z = target_position.z; 
        
    }

    

    //------
    resetCameraPosition() {
        let camera_root_transform = Transform.getMutable( resources["index"].camerabox );
        movePlayerTo(
            {
                newRelativePosition: Vector3.create(
                    camera_root_transform.position.x ,
                    camera_root_transform.position.y + 1,
                    camera_root_transform.position.z ,
                ),
                cameraTarget: Vector3.create(
                    camera_root_transform.position.x ,
                    camera_root_transform.position.y - 1,
                    camera_root_transform.position.z + 0.1,
                )
            }
        );
    }



    
    //-----
    normalizeQuaternion(q: Quaternion): Quaternion {
        const norm = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
        return { w: q.w / norm, x: q.x / norm, y: q.y / norm, z: q.z / norm };
    }
    
    //--------
    toDegrees( rad ) {
        return rad * 180 / Math.PI;
    }


    //----------
    getEulerYawFromQuaternion(q: Quaternion): number {
        const normalizedQ = this.normalizeQuaternion(q);
    
        const sinYaw = 2 * (normalizedQ.w * normalizedQ.y - normalizedQ.x * normalizedQ.z);
        const cosYaw = 1 - 2 * (normalizedQ.y * normalizedQ.y + normalizedQ.z * normalizedQ.z);
        const yaw = Math.atan2(sinYaw, cosYaw);
    
        // Convert radians to degrees if needed
        return this.toDegrees(yaw);
    }

    getEulerYawFromQuaternion2(q: Quaternion): number {
        const normalizedQ = this.normalizeQuaternion(q);
    
        const sinYaw = 2 * (normalizedQ.w * normalizedQ.y - normalizedQ.x * normalizedQ.z);
        const cosYaw = 1 - 2 * (normalizedQ.y * normalizedQ.y + normalizedQ.z * normalizedQ.z);
        const yaw = Math.atan2(sinYaw, cosYaw);
    
        // Convert radians to degrees if needed
        return yaw;
    }

    






    // Camera Yaw direction affects which is forward.
    //--------
    W_on_press() {

        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;

        resources["button_states"][InputAction.IA_FORWARD] = 0;
        resources["button_states"][InputAction.IA_BACKWARD] = 0;
        resources["button_states"][InputAction.IA_LEFT] = 0;
        resources["button_states"][InputAction.IA_RIGHT] = 0;
        
        if ( yaw >= -45 && yaw <= 45 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 1;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_LEFT] = 1;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 1;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_RIGHT] = 1;

        }

    }
    //--------
    A_on_press() {

        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;

        resources["button_states"][InputAction.IA_FORWARD] = 0;
        resources["button_states"][InputAction.IA_BACKWARD] = 0;
        resources["button_states"][InputAction.IA_LEFT] = 0;
        resources["button_states"][InputAction.IA_RIGHT] = 0;
        
        if ( yaw >= -45 && yaw <= 45 ) {
            resources["button_states"][InputAction.IA_LEFT] = 1;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 1;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_RIGHT] = 1;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 1;

        }
    }
   

    //--------
    S_on_press() {

        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;

        resources["button_states"][InputAction.IA_FORWARD] = 0;
        resources["button_states"][InputAction.IA_BACKWARD] = 0;
        resources["button_states"][InputAction.IA_LEFT] = 0;
        resources["button_states"][InputAction.IA_RIGHT] = 0;
        if ( yaw >= -45 && yaw <= 45 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 1;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_RIGHT] = 1;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 1;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_LEFT] = 1;

        }

    }
    //--------
    D_on_press() {
        
        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;

        resources["button_states"][InputAction.IA_FORWARD] = 0;
        resources["button_states"][InputAction.IA_BACKWARD] = 0;
        resources["button_states"][InputAction.IA_LEFT] = 0;
        resources["button_states"][InputAction.IA_RIGHT] = 0;

        if ( yaw >= -45 && yaw <= 45 ) {
            
            resources["button_states"][InputAction.IA_RIGHT] = 1;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 1;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_LEFT] = 1;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 1;

        }
    }



    //----------------
    W_on_release() {

        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;
        if ( yaw >= -45 && yaw <= 45 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 0;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_LEFT] = 0;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 0;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_RIGHT] = 0;
        }
    }   
    A_on_release() {
        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;
        if ( yaw >= -45 && yaw <= 45 ) {
            resources["button_states"][InputAction.IA_LEFT] = 0;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 0;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_RIGHT] = 0;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 0;
        }
    }
    S_on_release() {
        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;
        if ( yaw >= -45 && yaw <= 45 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 0;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_RIGHT] = 0;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 0;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_LEFT] = 0;
        }
    }
    D_on_release() {
        let yaw = resources["index"].getEulerYawFromQuaternion( Transform.get(engine.CameraEntity).rotation ) ;
        if ( yaw >= -45 && yaw <= 45 ) {
            resources["button_states"][InputAction.IA_RIGHT] = 0;
        } else if ( yaw >= -135 && yaw <= -45 ) {
            resources["button_states"][InputAction.IA_FORWARD] = 0;
        } else if ( yaw < -135 || yaw > 135 ) {
            resources["button_states"][InputAction.IA_LEFT] = 0;
        } else if ( yaw >= 45 && yaw <= 135 ) {
            resources["button_states"][InputAction.IA_BACKWARD] = 0;
        }
    }


    //----



    //----------
    update( dt ) {

        if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)){
            resources["stage"].next_level();  
        }

        // 1
        if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)){
            resources["stage"].restart_level();     
        }

        // 2
        if (inputSystem.isTriggered(InputAction.IA_ACTION_4, PointerEventType.PET_DOWN)){
            resources["index"].fix_camerabox_position_instant();
            resources["index"].resetCameraPosition();
        }

        // 3    
        if (inputSystem.isTriggered(InputAction.IA_ACTION_5, PointerEventType.PET_DOWN)){
            resources["stage"].back_to_lobby();     
        }

        // 4
        if (inputSystem.isTriggered(InputAction.IA_ACTION_6, PointerEventType.PET_DOWN)){
            
            resources["stage"].go_to_level();
            
        }

        
        


        if (inputSystem.isTriggered(InputAction.IA_FORWARD, PointerEventType.PET_DOWN)  )  {
            resources["index"].W_on_press();
        }
        
        if (inputSystem.isTriggered(InputAction.IA_LEFT, PointerEventType.PET_DOWN)  )  {
            resources["index"].A_on_press();
        }
        if (inputSystem.isTriggered(InputAction.IA_BACKWARD, PointerEventType.PET_DOWN)  ) {   
            resources["index"].S_on_press();
        }

        if (inputSystem.isTriggered(InputAction.IA_RIGHT, PointerEventType.PET_DOWN)  ) {
            resources["index"].D_on_press();
            
        }
        

        if (inputSystem.isTriggered(InputAction.IA_FORWARD, PointerEventType.PET_UP)){
            resources["index"].W_on_release();
        }
        if (inputSystem.isTriggered(InputAction.IA_LEFT, PointerEventType.PET_UP)){
            resources["index"].A_on_release();
        }
        if (inputSystem.isTriggered(InputAction.IA_BACKWARD, PointerEventType.PET_UP)){
            resources["index"].S_on_release();
        }

        if (inputSystem.isTriggered(InputAction.IA_RIGHT, PointerEventType.PET_UP)){
            resources["index"].D_on_release();
        }
        
       


        


        resources["index"].fix_player_position();
        resources["index"].fix_camerabox_position2();
        
        
    }
    
}



new Index();

